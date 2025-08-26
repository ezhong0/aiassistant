//
//  ChatView.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import SwiftUI
import Foundation

// MARK: - Data Models
struct Message: Identifiable {
    let id = UUID()
    let content: String
    let isFromUser: Bool
}

// Backend API Response Structure
struct TextCommandResponse: Codable {
    let success: Bool
    let type: String?
    let message: String
    let data: TextCommandResponseData?
    let error: String?
}

struct TextCommandResponseData: Codable {
    let response: String?
    let sessionId: String
    let toolCalls: [ToolCallInfo]?
    let toolResults: [ToolResultInfo]?
    let conversationContext: ConversationContext?
    
    // Optional fields
    let results: [ToolResult]?
    let errors: [ToolError]?
}

struct ToolCallInfo: Codable {
    let name: String
    let parameters: [String: String]?
}

struct ToolResultInfo: Codable {
    let toolName: String
    let success: Bool
    let message: String?
    let data: String?
    let error: String?
    let executionTime: Double?
}

struct ConversationContext: Codable {
    let conversationHistory: [ConversationHistoryEntry]?
    let lastActivity: String
}

struct ConversationHistoryEntry: Codable {
    let role: String
    let content: String
    let timestamp: String?
}

struct ToolResult: Codable {
    let tool: String
    let message: String?
    let data: String?
    let executionTime: Double?
}

struct ToolError: Codable {
    let tool: String
    let error: String
    let executionTime: Double?
}

enum APIError: Error {
    case noAuthToken
    case invalidResponse
    case networkError(Error)
    case authenticationFailed
    
    var localizedDescription: String {
        switch self {
        case .noAuthToken:
            return "Please sign in to continue"
        case .invalidResponse:
            return "Unable to understand server response"
        case .networkError(let error):
            return "Connection error: \(error.localizedDescription)"
        case .authenticationFailed:
            return "Authentication failed. Please sign in again."
        }
    }
}

// MARK: - Stub for ActionCardsManager (simplified version)
class ActionCardsManager: ObservableObject {
    @Published var isPresented: Bool = false
    
    func presentCards(_ cards: [Any]) {
        // Simplified implementation - just hide action cards for now
        isPresented = false
    }
}

// MARK: - Chat View Model
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
            
            // Handle successful response
            if response.success, let responseData = response.data {
                let content = responseData.response ?? response.message
                let assistantMessage = Message(content: content, isFromUser: false)
                messages.append(assistantMessage)
            } else {
                // Handle error response from server
                let errorMsg = response.error ?? response.message
                errorMessage = "Server error: \(errorMsg)"
            }
        } catch {
            errorMessage = "Failed to send message: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    private func sendTextCommand(_ command: String) async throws -> TextCommandResponse {
        guard let authManager = authManager else {
            throw APIError.noAuthToken
        }
        
        var authToken = authManager.getAuthToken()
        
        if authToken == nil {
            // If no token available, trigger sign in
            await authManager.signIn()
            
            // After sign in attempt, try to get token again
            authToken = authManager.getAuthToken()
        }
        
        guard let token = authToken else {
            throw APIError.noAuthToken
        }
        
        let url = URL(string: "\(baseURL)/api/assistant/text-command")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "command": command,
            "sessionId": sessionId
        ]
        
        // Add Google access token if available (required for Gmail operations)
        if let googleAccessToken = authManager.getGoogleAccessToken() {
            body["accessToken"] = googleAccessToken
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(NSError(domain: "InvalidResponse", code: -1, userInfo: nil))
        }
        
        // Try to decode the response regardless of status code
        // The backend returns JSON for both success and error cases
        do {
            return try JSONDecoder().decode(TextCommandResponse.self, from: data)
        } catch {
            // If JSON parsing fails, create a generic error response
            throw APIError.invalidResponse
        }
    }
}

struct ChatView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = ChatViewModel()
    @State private var messageText = ""
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        NavigationView {
            ZStack {
                VStack(spacing: 0) {
                    // Messages
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.messages) { message in
                                MessageView(message: message)
                            }
                        }
                        .padding()
                    }
                    
                    Divider()
                    
                    // Input area
                    VStack(spacing: 12) {
                    if viewModel.isLoading {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Assistant is thinking...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    if let errorMessage = viewModel.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    HStack {
                        TextField("Type your message...", text: $messageText, axis: .vertical)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($isTextFieldFocused)
                            .onSubmit {
                                sendMessage()
                            }
                        
                        Button(action: sendMessage) {
                            Image(systemName: "paperplane.fill")
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                                .background(
                                    Circle()
                                        .fill(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : Color.blue)
                                )
                        }
                        .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isLoading)
                    }
                    .padding()
                    .background(Color(.systemGroupedBackground))
                }
                
                // Close the main VStack(spacing: 0)
                }
                
                // Action Cards Overlay (simplified - full implementation in other files)
                if viewModel.actionCardsManager.isPresented {
                    VStack {
                        Spacer()
                        Text("Action cards functionality available")
                            .padding()
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(), value: viewModel.actionCardsManager.isPresented)
                }
            }
            .navigationTitle("Assistant")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign Out") {
                        authManager.signOut()
                    }
                }
            }
        }
        .onAppear {
            viewModel.authManager = authManager
        }
    }
    
    func sendMessage() {
        let trimmedMessage = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        
        Task {
            await viewModel.sendMessage(trimmedMessage)
            messageText = ""
        }
    }
}

struct MessageView: View {
    let message: Message
    
    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer()
                Text(message.content)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(16)
                    .frame(maxWidth: .infinity * 0.8, alignment: .trailing)
            } else {
                Text(message.content)
                    .padding()
                    .background(Color(.systemGray5))
                    .cornerRadius(16)
                    .frame(maxWidth: .infinity * 0.8, alignment: .leading)
                Spacer()
            }
        }
    }
}

// Preview temporarily disabled to avoid circular reference issues
// #Preview {
//     ChatView()
//         .environmentObject(AuthManager())
// }