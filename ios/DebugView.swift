import SwiftUI

/// Debug view that shows configuration and system information
/// Only displayed in non-production builds with debug logs enabled
struct DebugView: View {
    @ObservedObject var authManager: AuthenticationManager
    @StateObject private var securityManager = SecurityManager.shared
    @State private var healthStatus: HealthStatus?
    @State private var isCheckingHealth = false
    @State private var sslValidation: SSLValidationResult?
    @State private var isValidatingSSL = false
    
    private let config = AppConfiguration.shared
    
    var body: some View {
        NavigationView {
            List {
                // Environment Section
                Section("Environment") {
                    InfoRow("Environment", config.environmentName)
                    InfoRow("Debug Build", config.isDebugBuild ? "Yes" : "No")
                    InfoRow("Debug Logs", config.enableDebugLogs ? "Enabled" : "Disabled")
                    InfoRow("Log Level", config.logLevel.rawValue.capitalized)
                }
                
                // Backend Configuration
                Section("Backend Configuration") {
                    InfoRow("Backend URL", config.backendBaseURL)
                    InfoRow("API Timeout", "\(Int(config.apiTimeout))s")
                    
                    if config.enableDebugLogs {
                        InfoRow("Client ID", "\(config.googleClientID.prefix(20))...")
                    }
                }
                
                // Security Section
                Section("Security Status") {
                    HStack {
                        Text("Overall Security")
                        Spacer()
                        SecurityStatusBadge(status: securityManager.securityStatus)
                    }
                    
                    if case .warning(let issues) = securityManager.securityStatus {
                        ForEach(issues) { issue in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("⚠️ \(issue.description)")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                                Text(issue.recommendation)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    if case .insecure(let issues) = securityManager.securityStatus {
                        ForEach(issues) { issue in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("❌ \(issue.description)")
                                    .font(.caption)
                                    .foregroundColor(.red)
                                Text(issue.recommendation)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    InfoRow("ATS Secure", config.isATSSecure ? "✅ Yes" : "❌ No")
                    
                    // SSL Certificate Validation
                    if let validation = sslValidation {
                        switch validation {
                        case .secure(let info):
                            InfoRow("SSL Certificate", "✅ Valid")
                            Text(info)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        case .warning(let reason):
                            InfoRow("SSL Certificate", "⚠️ Warning")
                            Text(reason)
                                .font(.caption2)
                                .foregroundColor(.orange)
                        case .insecure(let reason):
                            InfoRow("SSL Certificate", "❌ Invalid")
                            Text(reason)
                                .font(.caption2)
                                .foregroundColor(.red)
                        }
                    }
                    
                    Button(action: validateSSLCertificate) {
                        HStack {
                            if isValidatingSSL {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text(isValidatingSSL ? "Validating..." : "Validate SSL Certificate")
                        }
                    }
                    .disabled(isValidatingSSL)
                }
                
                // Network Security
                if let networkInfo = securityManager.networkSecurityInfo {
                    Section("Network Security") {
                        InfoRow("Connection", networkInfo.isConnected ? "✅ Connected" : "❌ Disconnected")
                        InfoRow("Type", networkInfo.connectionType.description)
                        InfoRow("Expensive", networkInfo.isExpensive ? "Yes" : "No")
                        InfoRow("Constrained", networkInfo.isConstrained ? "Yes" : "No")
                    }
                }
                
                // Health Check
                Section("Backend Health") {
                    if let health = healthStatus {
                        InfoRow("Status", health.isHealthy ? "✅ Healthy" : "❌ Unhealthy")
                        InfoRow("Response Code", "\(health.statusCode)")
                        InfoRow("Last Check", formatDate(health.timestamp))
                    } else {
                        Text("No health check performed")
                            .foregroundColor(.secondary)
                    }
                    
                    Button(action: performHealthCheck) {
                        HStack {
                            if isCheckingHealth {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text(isCheckingHealth ? "Checking..." : "Check Backend Health")
                        }
                    }
                    .disabled(isCheckingHealth)
                }
                
                // Authentication
                if authManager.isSignedIn {
                    Section("Authentication") {
                        if let user = authManager.currentUser {
                            InfoRow("User", user.name)
                            InfoRow("Email", user.email)
                            InfoRow("User ID", user.id)
                        }
                        InfoRow("JWT Token", "Stored in Keychain")
                    }
                }
                
                // App Information
                Section("App Information") {
                    InfoRow("Bundle ID", Bundle.main.bundleIdentifier ?? "Unknown")
                    InfoRow("App Version", appVersion)
                    InfoRow("Build Number", buildNumber)
                    InfoRow("iOS Version", UIDevice.current.systemVersion)
                    InfoRow("Device Model", deviceModel)
                }
            }
            .navigationTitle("Debug Information")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        // Handle dismiss
                    }
                }
            }
        }
    }
    
    // MARK: - Helper Views
    
    private func InfoRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundColor(.primary)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
    
    // MARK: - Actions
    
    private func performHealthCheck() {
        isCheckingHealth = true
        
        Task {
            do {
                let apiService = APIService(authManager: authManager)
                let status = try await apiService.healthCheck()
                
                await MainActor.run {
                    self.healthStatus = status
                    self.isCheckingHealth = false
                }
            } catch {
                await MainActor.run {
                    self.healthStatus = HealthStatus(
                        isHealthy: false,
                        statusCode: 0,
                        environment: config.environmentName,
                        timestamp: Date()
                    )
                    self.isCheckingHealth = false
                }
                
                if config.enableDebugLogs {
                    print("❌ Health check failed: \(error)")
                }
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }
    
    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }
    
    private var deviceModel: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0) ?? "Unknown"
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
    
    private func validateSSLCertificate() {
        isValidatingSSL = true
        sslValidation = nil
        
        Task {
            do {
                let url = config.apiURL(for: "health")
                let result = await securityManager.validateSSLCertificate(for: url)
                
                await MainActor.run {
                    self.sslValidation = result
                    self.isValidatingSSL = false
                }
            } catch {
                await MainActor.run {
                    self.sslValidation = .insecure(reason: "Validation failed: \(error.localizedDescription)")
                    self.isValidatingSSL = false
                }
            }
        }
    }
}

// MARK: - Security Status Badge

struct SecurityStatusBadge: View {
    let status: SecurityStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            
            Text(statusText)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(8)
    }
    
    private var statusColor: Color {
        switch status {
        case .secure:
            return .green
        case .warning:
            return .orange
        case .insecure:
            return .red
        case .unknown:
            return .gray
        }
    }
    
    private var statusText: String {
        switch status {
        case .secure:
            return "Secure"
        case .warning:
            return "Warning"
        case .insecure:
            return "Insecure"
        case .unknown:
            return "Unknown"
        }
    }
}

// MARK: - Network Connection Type Extension

extension NetworkConnectionType {
    var description: String {
        switch self {
        case .wifi:
            return "Wi-Fi"
        case .cellular:
            return "Cellular"
        case .ethernet:
            return "Ethernet"
        case .unknown:
            return "Unknown"
        }
    }
}

// MARK: - Preview

#if DEBUG
struct DebugView_Previews: PreviewProvider {
    static var previews: some View {
        DebugView(authManager: AuthenticationManager())
    }
}
#endif