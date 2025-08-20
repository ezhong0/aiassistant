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
    func sendTextCommand(_ command: String) async throws -> AssistantResponse {
        let endpoint = "assistant/text-command"
        let body = [
            "command": command,
            "sessionId": UUID().uuidString
        ]
        
        let data = try await authManager.makeAuthenticatedRequest(
            to: endpoint,
            method: "POST",
            body: body
        )
        
        let response = try JSONDecoder().decode(AssistantResponse.self, from: data)
        
        if config.enableDebugLogs {
            print("📤 Sent command: \(command)")
            print("📥 Received response: \(response.message)")
        }
        
        return response
    }
    
    /// Get session information
    func getSession(_ sessionId: String) async throws -> SessionInfo {
        let endpoint = "assistant/session/\(sessionId)"
        
        let data = try await authManager.makeAuthenticatedRequest(to: endpoint)
        let session = try JSONDecoder().decode(SessionInfo.self, from: data)
        
        return session
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

struct AssistantResponse: Codable {
    let message: String
    let success: Bool
    let data: AnyCodable?
    let sessionId: String?
    
    private enum CodingKeys: String, CodingKey {
        case message, success, data, sessionId
    }
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