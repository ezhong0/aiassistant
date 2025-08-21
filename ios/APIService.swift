import Foundation

/// Service for making API calls to the assistant backend
class APIService: ObservableObject {
    
    private let config = AppConfiguration.shared
    private let authManager: AuthenticationManager
    
    init(authManager: AuthenticationManager) {
        self.authManager = authManager
    }
    
    // MARK: - Assistant API Calls
    
    /// Send a text command to the assistant
    func sendTextCommand(_ command: String, sessionId: String? = nil) async throws -> TextCommandResponse {
        let endpoint = "api/assistant/text-command"
        let body: [String: Any] = [
            "command": command,
            "sessionId": sessionId ?? UUID().uuidString,
            "context": [
                "userPreferences": [
                    "verbosity": "normal"
                ]
            ]
        ]
        
        let data = try await authManager.makeAuthenticatedRequest(
            to: endpoint,
            method: "POST",
            body: body
        )
        
        let response = try JSONDecoder().decode(TextCommandResponse.self, from: data)
        
        if config.enableDebugLogs {
            print("📤 Sent command: \(command)")
            print("📥 Received response type: \(response.type)")
            print("📥 Message: \(response.message)")
        }
        
        return response
    }
    
    /// Confirm or cancel a pending action
    func confirmAction(actionId: String, confirmed: Bool, sessionId: String) async throws -> ActionConfirmationResponse {
        let endpoint = "api/assistant/confirm-action"
        let body: [String: Any] = [
            "actionId": actionId,
            "confirmed": confirmed,
            "sessionId": sessionId
        ]
        
        let data = try await authManager.makeAuthenticatedRequest(
            to: endpoint,
            method: "POST",
            body: body
        )
        
        let response = try JSONDecoder().decode(ActionConfirmationResponse.self, from: data)
        
        if config.enableDebugLogs {
            print("📤 Confirmed action: \(actionId) - \(confirmed ? "YES" : "NO")")
            print("📥 Confirmation result: \(response.message)")
        }
        
        return response
    }
    
    /// Get session information
    func getSession(_ sessionId: String) async throws -> SessionInfo {
        let endpoint = "api/assistant/session/\(sessionId)"
        
        let data = try await authManager.makeAuthenticatedRequest(to: endpoint)
        let session = try JSONDecoder().decode(SessionInfo.self, from: data)
        
        return session
    }
    
    /// Delete a session
    func deleteSession(_ sessionId: String) async throws {
        let endpoint = "api/assistant/session/\(sessionId)"
        
        _ = try await authManager.makeAuthenticatedRequest(
            to: endpoint,
            method: "DELETE"
        )
        
        if config.enableDebugLogs {
            print("🗑️ Deleted session: \(sessionId)")
        }
    }
    
    /// Health check for the backend service
    func healthCheck() async throws -> HealthStatus {
        let url = config.apiURL(for: "health")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10 // Shorter timeout for health check
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        let status = HealthStatus(
            isHealthy: httpResponse.statusCode == 200,
            statusCode: httpResponse.statusCode,
            environment: config.environmentName,
            timestamp: Date()
        )
        
        if config.enableDebugLogs {
            print("🏥 Health check: \(status.isHealthy ? "✅ Healthy" : "❌ Unhealthy")")
            print("🔧 Backend: \(config.backendBaseURL)")
        }
        
        return status
    }
}

// MARK: - APIService now uses types from APIModels.swift