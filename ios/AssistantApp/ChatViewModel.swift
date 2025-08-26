//
//  ChatViewModel.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import Foundation

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var actionCardsManager = ActionCardsManager()
    
    var authManager: AuthManager?
    private let baseURL = "http://localhost:3000"
    private let sessionId = UUID().uuidString
    
    func sendMessage(_ text: String) async {
        // Add user message
        let userMessage = Message(content: text, isFromUser: true)
        messages.append(userMessage)
        
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await sendTextCommand(text)
            let assistantMessage = Message(content: response.response, isFromUser: false)
            messages.append(assistantMessage)
        } catch {
            errorMessage = "Failed to send message: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    private func sendTextCommand(_ command: String) async throws -> TextCommandResponse {
        guard let authToken = authManager?.getAuthToken() else {
            throw APIError.noAuthToken
        }
        
        let url = URL(string: "\(baseURL)/api/assistant/text-command")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        
        let body = [
            "command": command,
            "sessionId": sessionId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        return try JSONDecoder().decode(TextCommandResponse.self, from: data)
    }
}

// Models imported from Message.swift