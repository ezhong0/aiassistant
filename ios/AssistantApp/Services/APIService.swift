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

// MARK: - Response Models

struct TextCommandResponse: Codable {
    let success: Bool
    let type: ResponseType
    let message: String
    let data: ResponseData?
    
    enum ResponseType: String, Codable {
        case response = "response"
        case confirmationRequired = "confirmation_required"
        case actionCompleted = "action_completed"
        case authRequired = "auth_required"
    }
}

struct ResponseData: Codable {
    let sessionId: String?
    let conversationContext: ConversationContext?
    let pendingAction: PendingAction?
    let confirmationPrompt: String?
    let toolResults: [ToolResult]?
    let requiredScopes: [String]?
    let redirectUrl: String?
}

struct ConversationContext: Codable {
    let messages: [ConversationMessage]?
    let userPreferences: UserPreferences?
}

struct ConversationMessage: Codable {
    let role: String
    let content: String
    let timestamp: String
}

struct UserPreferences: Codable {
    let verbosity: String?
}

struct PendingAction: Codable {
    let actionId: String
    let type: String
    let parameters: [String: AnyCodable]
    let awaitingConfirmation: Bool
}

struct ToolResult: Codable {
    let toolName: String
    let result: AnyCodable?
    let success: Bool
    let error: String?
    let executionTime: Int?
}

struct ActionConfirmationResponse: Codable {
    let success: Bool
    let type: TextCommandResponse.ResponseType
    let message: String
    let data: ConfirmationData?
}

struct ConfirmationData: Codable {
    let actionId: String
    let status: String
    let result: AnyCodable?
    let sessionId: String?
}

struct SessionInfo: Codable {
    let sessionId: String
    let userId: String?
    let createdAt: Date
    let lastActivity: Date
    let expiresAt: Date
}

struct HealthStatus: Codable {
    let isHealthy: Bool
    let statusCode: Int
    let environment: String
    let timestamp: Date
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidResponse
    case networkError(Error)
    case decodingError(Error)
    case serverError(Int, String)
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        }
    }
}

// MARK: - Helper for Any Codable

struct AnyCodable: Codable {
    private let value: Any
    
    init<T>(_ value: T?) {
        self.value = value ?? ()
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            value = dictionary
        } else {
            value = ()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [AnyCodable]:
            try container.encode(array)
        case let dictionary as [String: AnyCodable]:
            try container.encode(dictionary)
        default:
            try container.encodeNil()
        }
    }
}