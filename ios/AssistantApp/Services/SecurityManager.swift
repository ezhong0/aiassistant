import Foundation
import Network

/// Security manager that provides runtime security validation and monitoring
class SecurityManager: ObservableObject {
    
    static let shared = SecurityManager()
    
    @Published private(set) var securityStatus: SecurityStatus = .unknown
    @Published private(set) var networkSecurityInfo: NetworkSecurityInfo?
    
    private let config = AppConfiguration.shared
    private var networkMonitor: NWPathMonitor?
    
    private init() {
        validateSecurityConfiguration()
        startNetworkMonitoring()
    }
    
    // MARK: - Security Validation
    
    /// Validates the overall security configuration
    func validateSecurityConfiguration() {
        var issues: [SecurityIssue] = []
        
        // Check URL security
        if let urlIssue = validateURLSecurity() {
            issues.append(urlIssue)
        }
        
        // Check ATS configuration
        if let atsIssue = validateATSConfiguration() {
            issues.append(atsIssue)
        }
        
        // Check environment configuration
        if let envIssue = validateEnvironmentConfiguration() {
            issues.append(envIssue)
        }
        
        // Determine overall status
        if issues.isEmpty {
            securityStatus = .secure
        } else if issues.contains(where: { $0.severity == .critical }) {
            securityStatus = .insecure(issues)
        } else {
            securityStatus = .warning(issues)
        }
        
        logSecurityStatus()
    }
    
    /// Validates URL security
    private func validateURLSecurity() -> SecurityIssue? {
        let url = config.backendBaseURL
        
        if config.isProduction {
            if !url.hasPrefix("https://") {
                return SecurityIssue(
                    type: .insecureProtocol,
                    severity: .critical,
                    description: "Production environment must use HTTPS",
                    recommendation: "Update backend URL to use HTTPS"
                )
            }
            
            if url.contains("localhost") {
                return SecurityIssue(
                    type: .localhostInProduction,
                    severity: .critical,
                    description: "Production environment cannot use localhost",
                    recommendation: "Configure production backend URL"
                )
            }
        } else {
            if !url.hasPrefix("https://") && !url.hasPrefix("http://localhost") && !url.hasPrefix("http://127.0.0.1") {
                return SecurityIssue(
                    type: .insecureProtocol,
                    severity: .warning,
                    description: "Using HTTP instead of HTTPS",
                    recommendation: "Consider using HTTPS for better security"
                )
            }
        }
        
        return nil
    }
    
    /// Validates ATS configuration
    private func validateATSConfiguration() -> SecurityIssue? {
        guard let atsConfig = Bundle.main.infoDictionary?["NSAppTransportSecurity"] as? [String: Any] else {
            return SecurityIssue(
                type: .missingATS,
                severity: .warning,
                description: "App Transport Security not configured",
                recommendation: "Configure ATS for better security"
            )
        }
        
        let allowsArbitraryLoads = atsConfig["NSAllowsArbitraryLoads"] as? Bool ?? false
        let allowsLocalNetworking = atsConfig["NSAllowsLocalNetworking"] as? Bool ?? false
        
        if config.isProduction {
            if allowsArbitraryLoads {
                return SecurityIssue(
                    type: .insecureATS,
                    severity: .critical,
                    description: "Production allows arbitrary loads",
                    recommendation: "Set NSAllowsArbitraryLoads to false"
                )
            }
            
            if allowsLocalNetworking {
                return SecurityIssue(
                    type: .insecureATS,
                    severity: .critical,
                    description: "Production allows local networking",
                    recommendation: "Set NSAllowsLocalNetworking to false"
                )
            }
        }
        
        return nil
    }
    
    /// Validates environment configuration
    private func validateEnvironmentConfiguration() -> SecurityIssue? {
        if config.isProduction && config.enableDebugLogs {
            return SecurityIssue(
                type: .debugInProduction,
                severity: .warning,
                description: "Debug logs enabled in production",
                recommendation: "Disable debug logs for production builds"
            )
        }
        
        return nil
    }
    
    // MARK: - Network Security Monitoring
    
    private func startNetworkMonitoring() {
        networkMonitor = NWPathMonitor()
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.updateNetworkSecurityInfo(path)
            }
        }
        
        let queue = DispatchQueue(label: "NetworkSecurityMonitor")
        networkMonitor?.start(queue: queue)
    }
    
    private func updateNetworkSecurityInfo(_ path: NWPath) {
        let connectionType: NetworkConnectionType
        
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
        
        networkSecurityInfo = NetworkSecurityInfo(
            isConnected: path.status == .satisfied,
            connectionType: connectionType,
            isExpensive: path.isExpensive,
            isConstrained: path.isConstrained,
            timestamp: Date()
        )
        
        if config.enableDebugLogs {
            print("🌐 Network Security Update: \(connectionType), Connected: \(path.status == .satisfied)")
        }
    }
    
    // MARK: - Certificate Validation
    
    /// Validates SSL certificate for a given URL
    func validateSSLCertificate(for url: URL) async -> SSLValidationResult {
        guard url.scheme == "https" else {
            return .insecure(reason: "URL does not use HTTPS")
        }
        
        // Create a simple URL request to test SSL
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 10
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode >= 200 && httpResponse.statusCode < 400 {
                return .secure(certificateInfo: "Valid SSL certificate")
            } else {
                return .warning(reason: "Unexpected response code")
            }
        } catch {
            if error.localizedDescription.contains("certificate") ||
               error.localizedDescription.contains("SSL") ||
               error.localizedDescription.contains("TLS") {
                return .insecure(reason: "SSL certificate validation failed: \(error.localizedDescription)")
            } else {
                return .warning(reason: "Network error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Logging
    
    private func logSecurityStatus() {
        if config.enableDebugLogs {
            print("🔒 Security Status: \(securityStatus)")
            
            switch securityStatus {
            case .secure:
                print("   ✅ All security checks passed")
            case .warning(let issues):
                print("   ⚠️ Security warnings:")
                issues.forEach { print("     - \($0.description)") }
            case .insecure(let issues):
                print("   ❌ Security issues:")
                issues.forEach { print("     - \($0.description)") }
            case .unknown:
                print("   ❓ Security status unknown")
            }
        }
    }
    
    deinit {
        networkMonitor?.cancel()
    }
}

// MARK: - Security Types

enum SecurityStatus: Equatable {
    case secure
    case warning([SecurityIssue])
    case insecure([SecurityIssue])
    case unknown
    
    var isSecure: Bool {
        switch self {
        case .secure:
            return true
        default:
            return false
        }
    }
    
    var hasWarnings: Bool {
        switch self {
        case .warning:
            return true
        default:
            return false
        }
    }
    
    var hasCriticalIssues: Bool {
        switch self {
        case .insecure:
            return true
        default:
            return false
        }
    }
}

struct SecurityIssue: Identifiable, Equatable {
    let id = UUID()
    let type: SecurityIssueType
    let severity: SecuritySeverity
    let description: String
    let recommendation: String
}

enum SecurityIssueType {
    case insecureProtocol
    case localhostInProduction
    case insecureATS
    case missingATS
    case debugInProduction
    case invalidCertificate
}

enum SecuritySeverity {
    case info
    case warning
    case critical
}

struct NetworkSecurityInfo {
    let isConnected: Bool
    let connectionType: NetworkConnectionType
    let isExpensive: Bool
    let isConstrained: Bool
    let timestamp: Date
}

enum NetworkConnectionType {
    case wifi
    case cellular
    case ethernet
    case unknown
}

enum SSLValidationResult {
    case secure(certificateInfo: String)
    case warning(reason: String)
    case insecure(reason: String)
    
    var isSecure: Bool {
        switch self {
        case .secure:
            return true
        default:
            return false
        }
    }
}