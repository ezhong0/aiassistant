# Configuration Usage Examples

This document shows how to use the new environment-based configuration system in your iOS app.

## Basic Usage in Views

### Main App with Debug Information

```swift
import SwiftUI

@main
struct AssistantAppApp: App {
    @StateObject private var authManager = AuthenticationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .onAppear {
                    showConfigurationInfo()
                }
        }
    }
    
    private func showConfigurationInfo() {
        let config = AppConfiguration.shared
        
        if config.enableDebugLogs {
            print("🚀 App starting with configuration:")
            print(config.configurationSummary)
        }
    }
}
```

### Content View with Environment Awareness

```swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var showingDebugView = false
    
    private let config = AppConfiguration.shared
    
    var body: some View {
        Group {
            if authManager.isSignedIn {
                MainAppView()
            } else {
                SignInView()
            }
        }
        .overlay(alignment: .topTrailing) {
            // Show debug button in non-production builds
            if authManager.shouldShowDebugInfo {
                debugButton
            }
        }
        .sheet(isPresented: $showingDebugView) {
            DebugView(authManager: authManager)
        }
    }
    
    private var debugButton: some View {
        Button(action: { showingDebugView = true }) {
            Image(systemName: "info.circle")
                .foregroundColor(.blue)
                .padding()
        }
    }
}
```

### Sign In View with Environment Info

```swift
import SwiftUI

struct SignInView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var showingError = false
    
    private let config = AppConfiguration.shared
    
    var body: some View {
        VStack(spacing: 30) {
            // App Title
            Text("Assistant App")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            // Environment Badge (non-production only)
            if !config.isProduction {
                environmentBadge
            }
            
            // Sign In Button
            Button(action: signIn) {
                HStack {
                    Image("google_logo")
                        .resizable()
                        .frame(width: 20, height: 20)
                    
                    Text("Sign in with Google")
                        .fontWeight(.medium)
                }
                .foregroundColor(.black)
                .padding()
                .background(Color.white)
                .cornerRadius(8)
                .shadow(radius: 2)
            }
            .disabled(authManager.isLoading)
            
            // Loading State
            if authManager.isLoading {
                ProgressView("Signing in...")
            }
            
            // Error Message
            if let errorMessage = authManager.errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            
            Spacer()
            
            // Configuration Info (debug only)
            if config.shouldShowDebugUI {
                configurationInfo
            }
        }
        .padding()
    }
    
    private var environmentBadge: some View {
        HStack {
            Circle()
                .fill(environmentColor)
                .frame(width: 8, height: 8)
            
            Text(config.environmentName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(environmentColor.opacity(0.1))
        .cornerRadius(12)
    }
    
    private var environmentColor: Color {
        switch config.environmentName {
        case "Development":
            return .green
        case "Staging":
            return .orange
        case "Production":
            return .red
        default:
            return .gray
        }
    }
    
    private var configurationInfo: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Debug Information")
                .font(.caption)
                .fontWeight(.bold)
            
            Text("Environment: \(config.environmentName)")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Text("Backend: \(config.backendBaseURL)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    private func signIn() {
        Task {
            await authManager.signIn()
        }
    }
}
```

## Using APIService with Configuration

### Command Input View

```swift
import SwiftUI

struct CommandInputView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var command = ""
    @State private var response: AssistantResponse?
    @State private var isLoading = false
    @State private var error: Error?
    
    private lazy var apiService = APIService(authManager: authManager)
    private let config = AppConfiguration.shared
    
    var body: some View {
        VStack(spacing: 20) {
            // Command Input
            VStack(alignment: .leading) {
                Text("Send Command")
                    .font(.headline)
                
                TextField("Type your command...", text: $command)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Button("Send") {
                    sendCommand()
                }
                .disabled(command.isEmpty || isLoading)
                .buttonStyle(.borderedProminent)
            }
            
            // Loading State
            if isLoading {
                ProgressView("Processing...")
            }
            
            // Response
            if let response = response {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Response")
                        .font(.headline)
                    
                    Text(response.message)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    
                    if config.enableDebugLogs && response.success {
                        Text("✅ Success")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
            }
            
            // Error
            if let error = error {
                Text("Error: \(error.localizedDescription)")
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
            
            Spacer()
        }
        .padding()
        .navigationTitle("Assistant")
    }
    
    private func sendCommand() {
        guard !command.isEmpty else { return }
        
        isLoading = true
        error = nil
        
        Task {
            do {
                let result = try await apiService.sendTextCommand(command)
                
                await MainActor.run {
                    self.response = result
                    self.isLoading = false
                    self.command = ""
                }
                
            } catch {
                await MainActor.run {
                    self.error = error
                    self.isLoading = false
                }
                
                if config.enableDebugLogs {
                    print("❌ Command failed: \(error)")
                }
            }
        }
    }
}
```

## Advanced Configuration Usage

### Network Monitoring

```swift
import SwiftUI
import Network

class NetworkMonitor: ObservableObject {
    @Published var isConnected = false
    @Published var connectionType: ConnectionType = .unknown
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    private let config = AppConfiguration.shared
    
    enum ConnectionType {
        case wifi, cellular, ethernet, unknown
    }
    
    init() {
        startMonitoring()
    }
    
    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.updateConnectionType(path)
            }
        }
        
        monitor.start(queue: queue)
    }
    
    private func updateConnectionType(_ path: NWPath) {
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
        
        if config.enableDebugLogs {
            print("🌐 Network: \(isConnected ? "Connected" : "Disconnected") via \(connectionType)")
        }
    }
}
```

### Settings View with Configuration

```swift
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @StateObject private var networkMonitor = NetworkMonitor()
    @State private var showingDebugView = false
    
    private let config = AppConfiguration.shared
    
    var body: some View {
        NavigationView {
            List {
                // User Section
                if let user = authManager.currentUser {
                    Section("Account") {
                        HStack {
                            AsyncImage(url: URL(string: user.picture ?? "")) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                            } placeholder: {
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                            }
                            .frame(width: 50, height: 50)
                            .clipShape(Circle())
                            
                            VStack(alignment: .leading) {
                                Text(user.name)
                                    .font(.headline)
                                Text(user.email)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
                
                // App Settings
                Section("Settings") {
                    NavigationLink("Notifications") {
                        NotificationSettingsView()
                    }
                    
                    NavigationLink("Privacy") {
                        PrivacySettingsView()
                    }
                }
                
                // Debug Section (non-production only)
                if authManager.shouldShowDebugInfo {
                    Section("Debug") {
                        Button("Debug Information") {
                            showingDebugView = true
                        }
                        
                        HStack {
                            Text("Network Status")
                            Spacer()
                            Text(networkMonitor.isConnected ? "Connected" : "Disconnected")
                                .foregroundColor(networkMonitor.isConnected ? .green : .red)
                        }
                        
                        HStack {
                            Text("Environment")
                            Spacer()
                            Text(config.environmentName)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // Sign Out
                Section {
                    Button("Sign Out") {
                        Task {
                            await authManager.signOut()
                        }
                    }
                    .foregroundColor(.red)
                }
            }
            .navigationTitle("Settings")
        }
        .sheet(isPresented: $showingDebugView) {
            DebugView(authManager: authManager)
        }
    }
}
```

## Configuration Best Practices

### 1. Environment-Specific Features

```swift
// Enable beta features only in development/staging
if !config.isProduction {
    // Show experimental UI
}

// Different analytics for different environments
if config.isProduction {
    // Enable production analytics
} else {
    // Use debug analytics or disable
}
```

### 2. Logging Best Practices

```swift
// Use configuration-aware logging
func logMessage(_ message: String, level: LogLevel = .info) {
    guard config.logLevel.rawValue <= level.rawValue else { return }
    
    if config.enableDebugLogs {
        print("[\(level.rawValue.uppercased())] \(message)")
    }
}

// Usage
logMessage("User signed in successfully", level: .info)
logMessage("Debug: Processing command", level: .debug)
```

### 3. Error Handling per Environment

```swift
func handleError(_ error: Error) {
    if config.isProduction {
        // Log minimal error info, show user-friendly message
        logMessage("Error occurred: \(error.localizedDescription)", level: .error)
        showUserFriendlyError()
    } else {
        // Show detailed error info for debugging
        logMessage("Detailed error: \(error)", level: .debug)
        showDetailedError(error)
    }
}
```

This configuration system provides a robust foundation for managing different environments while maintaining security and providing helpful debugging information when needed.