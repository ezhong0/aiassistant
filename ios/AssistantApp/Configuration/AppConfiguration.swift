import Foundation

/// Environment types for the application
enum Environment: String, CaseIterable {
    case development = "Development"
    case staging = "Staging"
    case production = "Production"
    
    var configFileName: String {
        return self.rawValue
    }
}

/// Log levels for the application
enum LogLevel: String {
    case debug = "debug"
    case info = "info"
    case warning = "warning"
    case error = "error"
}

/// Main configuration class that manages environment-specific settings
class AppConfiguration {
    
    // MARK: - Singleton
    static let shared = AppConfiguration()
    
    // MARK: - Properties
    private let configuration: [String: Any]
    private let googleConfiguration: [String: Any]
    private let environment: Environment
    
    // MARK: - Configuration Values
    var backendBaseURL: String {
        guard let url = configuration["BackendBaseURL"] as? String,
              !url.isEmpty,
              !url.contains("REPLACE_WITH") else {
            fatalError("❌ BackendBaseURL is not configured for \(environment.rawValue) environment. Please set a valid URL in \(environment.configFileName).plist")
        }
        return url
    }
    
    var googleClientID: String {
        guard let clientID = googleConfiguration["CLIENT_ID"] as? String,
              !clientID.isEmpty,
              !clientID.contains("REPLACE_WITH") else {
            fatalError("❌ GoogleClientID is not configured for \(environment.rawValue) environment. Please configure GoogleClient-\(environment.rawValue).plist")
        }
        return clientID
    }
    
    var googleReversedClientID: String {
        guard let reversedClientID = googleConfiguration["REVERSED_CLIENT_ID"] as? String,
              !reversedClientID.isEmpty,
              !reversedClientID.contains("REPLACE_WITH") else {
            fatalError("❌ Google Reversed Client ID is not configured for \(environment.rawValue) environment")
        }
        return reversedClientID
    }
    
    var googleBundleID: String {
        return googleConfiguration["BUNDLE_ID"] as? String ?? Bundle.main.bundleIdentifier ?? ""
    }
    
    var googleProjectID: String {
        return googleConfiguration["PROJECT_ID"] as? String ?? ""
    }
    
    var apiTimeout: TimeInterval {
        return TimeInterval(configuration["ApiTimeout"] as? Int ?? 30)
    }
    
    var logLevel: LogLevel {
        let levelString = configuration["LogLevel"] as? String ?? "info"
        return LogLevel(rawValue: levelString) ?? .info
    }
    
    var enableDebugLogs: Bool {
        return configuration["EnableDebugLogs"] as? Bool ?? false
    }
    
    var isProduction: Bool {
        return environment == .production
    }
    
    var isDevelopment: Bool {
        return environment == .development
    }
    
    var isStaging: Bool {
        return environment == .staging
    }
    
    var environmentName: String {
        return environment.rawValue
    }
    
    // MARK: - Initialization
    private init() {
        // Determine current environment from build configuration
        #if PRODUCTION
        self.environment = .production
        #elseif STAGING
        self.environment = .staging
        #else
        self.environment = .development
        #endif
        
        // Load configuration from appropriate plist file
        guard let path = Bundle.main.path(forResource: environment.configFileName, ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path) as? [String: Any] else {
            fatalError("❌ Could not load \(environment.configFileName).plist configuration file")
        }
        
        self.configuration = plist
        
        // Load Google client configuration
        let googleConfigFileName = "GoogleClient-\(environment.rawValue)"
        guard let googlePath = Bundle.main.path(forResource: googleConfigFileName, ofType: "plist"),
              let googlePlist = NSDictionary(contentsOfFile: googlePath) as? [String: Any] else {
            fatalError("❌ Could not load \(googleConfigFileName).plist Google configuration file")
        }
        
        self.googleConfiguration = googlePlist
        
        // Validate configuration on initialization
        self.validateConfiguration()
        
        // Log current configuration (only in non-production)
        if !isProduction {
            logCurrentConfiguration()
        }
    }
    
    // MARK: - Validation
    private func validateConfiguration() {
        var errors: [String] = []
        
        // Validate BackendBaseURL
        if let url = configuration["BackendBaseURL"] as? String {
            if url.isEmpty {
                errors.append("BackendBaseURL is empty")
            } else if url.contains("REPLACE_WITH") {
                if isProduction {
                    errors.append("BackendBaseURL must be configured for production builds")
                } else {
                    print("⚠️ Warning: BackendBaseURL contains placeholder value in \(environment.rawValue) environment")
                }
            } else if !isValidURL(url) {
                errors.append("BackendBaseURL is not a valid URL: \(url)")
            }
        } else {
            errors.append("BackendBaseURL is missing from configuration")
        }
        
        // Validate Google Client Configuration
        if let clientID = googleConfiguration["CLIENT_ID"] as? String {
            if clientID.isEmpty {
                errors.append("Google CLIENT_ID is empty")
            } else if clientID.contains("REPLACE_WITH") {
                if isProduction {
                    errors.append("Google CLIENT_ID must be configured for production builds")
                } else {
                    print("⚠️ Warning: Google CLIENT_ID contains placeholder value in \(environment.rawValue) environment")
                }
            } else if !isValidGoogleClientID(clientID) {
                errors.append("Google CLIENT_ID format appears invalid")
            }
        } else {
            errors.append("Google CLIENT_ID is missing from GoogleClient configuration")
        }
        
        // Validate Reversed Client ID
        if let reversedClientID = googleConfiguration["REVERSED_CLIENT_ID"] as? String {
            if reversedClientID.contains("REPLACE_WITH") && isProduction {
                errors.append("Google REVERSED_CLIENT_ID must be configured for production builds")
            }
        } else {
            errors.append("Google REVERSED_CLIENT_ID is missing from GoogleClient configuration")
        }
        
        // Validate Environment
        if let envString = configuration["Environment"] as? String {
            if envString != environment.rawValue {
                errors.append("Environment mismatch: expected \(environment.rawValue), got \(envString)")
            }
        } else {
            errors.append("Environment is missing from configuration")
        }
        
        // Fail if there are validation errors
        if !errors.isEmpty {
            let errorMessage = "❌ Configuration validation failed for \(environment.rawValue):\n" + 
                              errors.map { "• \($0)" }.joined(separator: "\n")
            fatalError(errorMessage)
        }
    }
    
    // MARK: - URL Helpers
    func apiURL(for endpoint: String) -> URL {
        let cleanEndpoint = endpoint.hasPrefix("/") ? String(endpoint.dropFirst()) : endpoint
        let urlString = "\(backendBaseURL)/\(cleanEndpoint)"
        
        guard let url = URL(string: urlString) else {
            fatalError("❌ Could not create URL from: \(urlString)")
        }
        
        return url
    }
    
    func authURL(for endpoint: String) -> URL {
        return apiURL(for: "auth/\(endpoint)")
    }
    
    func assistantURL(for endpoint: String) -> URL {
        return apiURL(for: "api/assistant/\(endpoint)")
    }
    
    // MARK: - Private Helpers
    private func isValidURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString),
              let scheme = url.scheme else {
            return false
        }
        
        // Allow http for development, require https for production
        if isProduction {
            return scheme == "https"
        } else {
            return ["http", "https"].contains(scheme)
        }
    }
    
    private func isValidGoogleClientID(_ clientID: String) -> Bool {
        // Basic validation for Google Client ID format
        return clientID.contains(".apps.googleusercontent.com") && 
               clientID.split(separator: "-").count >= 2
    }
    
    private func logCurrentConfiguration() {
        print("🔧 App Configuration Loaded:")
        print("   Environment: \(environmentName)")
        print("   Backend URL: \(backendBaseURL)")
        print("   Client ID: \(googleClientID.prefix(20))...")
        print("   API Timeout: \(apiTimeout)s")
        print("   Log Level: \(logLevel.rawValue)")
        print("   Debug Logs: \(enableDebugLogs)")
        
        // Log security status
        if !securityWarnings.isEmpty {
            print("🔒 Security Warnings:")
            securityWarnings.forEach { print("   \($0)") }
        } else {
            print("🔒 Security: Configuration appears secure")
        }
    }
    
    /// Get ATS configuration from Info.plist
    private func getATSConfiguration() -> [String: Any]? {
        return Bundle.main.infoDictionary?["NSAppTransportSecurity"] as? [String: Any]
    }
}

// MARK: - Configuration Extensions
extension AppConfiguration {
    
    /// Returns user-friendly description of current configuration
    var configurationSummary: String {
        return """
        Environment: \(environmentName)
        Backend: \(backendBaseURL)
        Debug Logs: \(enableDebugLogs ? "Enabled" : "Disabled")
        """
    }
    
    /// Returns whether the app is running in a debug configuration
    var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    /// Returns whether the app should show debug UI elements
    var shouldShowDebugUI: Bool {
        return enableDebugLogs && !isProduction
    }
    
    // MARK: - Security Properties
    
    /// Returns whether the current configuration is secure for production
    var isSecure: Bool {
        if isProduction {
            // Production must use HTTPS
            guard backendBaseURL.hasPrefix("https://") else { return false }
            
            // Production cannot use localhost
            guard !backendBaseURL.contains("localhost") else { return false }
            
            // Production should not allow debug logs
            guard !enableDebugLogs else { return false }
            
            return true
        }
        
        return true // Development and staging are allowed to be less secure
    }
    
    /// Returns security validation warnings for the current configuration
    var securityWarnings: [String] {
        var warnings: [String] = []
        
        if !backendBaseURL.hasPrefix("https://") {
            if isProduction {
                warnings.append("❌ Production environment must use HTTPS")
            } else {
                warnings.append("⚠️ Using HTTP instead of HTTPS")
            }
        }
        
        if backendBaseURL.contains("localhost") && !isDevelopment {
            warnings.append("⚠️ Using localhost in non-development environment")
        }
        
        if enableDebugLogs && isProduction {
            warnings.append("❌ Debug logs enabled in production")
        }
        
        return warnings
    }
    
    /// Returns whether ATS (App Transport Security) is properly configured
    var isATSSecure: Bool {
        guard let atsConfig = getATSConfiguration() else { return false }
        
        let allowsArbitraryLoads = atsConfig["NSAllowsArbitraryLoads"] as? Bool ?? false
        let allowsLocalNetworking = atsConfig["NSAllowsLocalNetworking"] as? Bool ?? false
        
        if isProduction {
            // Production must not allow arbitrary loads or local networking
            return !allowsArbitraryLoads && !allowsLocalNetworking
        }
        
        return true // Development and staging are allowed more flexibility
    }
}