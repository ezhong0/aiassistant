//
//  ChatViewModel.swift
//  AssistantApp
//
//  Created by Assistant on 8/21/25.
//

import Foundation
import SwiftUI

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var currentCommand: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var sessionId: String
    
    private var apiService: APIService?
    private var authManager: AuthenticationManager?
    private var pendingAction: PendingAction?
    
    init() {
        self.sessionId = Self.getOrCreateSessionId()
    }
    
    func setAuthManager(_ authManager: AuthenticationManager) {
        self.authManager = authManager
        self.apiService = APIService(authManager: authManager)
        
        // Check if we have required scopes for contacts and Gmail
        if !authManager.hasRequiredScopes {
            Task {
                do {
                    try await authManager.requestAdditionalScopesIfNeeded()
                } catch {
                    print("⚠️ Could not request additional scopes: \(error)")
                }
            }
        }
    }
    
    // MARK: - Session Management
    
    private static func getOrCreateSessionId() -> String {
        let key = "current_session_id"
        if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty {
            return existing
        }
        
        let newSessionId = "ios-session-\(UUID().uuidString)"
        UserDefaults.standard.set(newSessionId, forKey: key)
        return newSessionId
    }
    
    func startNewSession() {
        sessionId = "ios-session-\(UUID().uuidString)"
        UserDefaults.standard.set(sessionId, forKey: "current_session_id")
        messages.removeAll()
        pendingAction = nil
        errorMessage = nil
    }
    
    // MARK: - Message Handling
    
    func sendCommand() async {
        guard !currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let apiService = apiService else {
            return
        }
        
        let command = currentCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Add user message to chat
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            type: .user,
            content: command,
            timestamp: Date()
        )
        messages.append(userMessage)
        
        // Clear input
        currentCommand = ""
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await apiService.sendTextCommand(command, sessionId: sessionId)
            await handleResponse(response)
            
        } catch {
            await handleError(error)
        }
        
        isLoading = false
    }
    
    private func handleResponse(_ response: TextCommandResponse) async {
        let assistantMessage = ChatMessage(
            id: UUID().uuidString,
            type: .assistant,
            content: response.message,
            timestamp: Date()
        )
        messages.append(assistantMessage)
        
        switch response.type {
        case .response:
            // Simple response, no action needed
            break
            
        case .confirmationRequired:
            await handleConfirmationRequired(response)
            
        case .actionCompleted:
            await handleActionCompleted(response)
            
        case .authRequired:
            await handleAuthRequired(response)
        }
    }
    
    private func handleConfirmationRequired(_ response: TextCommandResponse) async {
        guard let data = response.data,
              let pendingAction = data.pendingAction else {
            return
        }
        
        self.pendingAction = pendingAction
        
        // Add confirmation message to chat
        let confirmationMessage = ChatMessage(
            id: UUID().uuidString,
            type: .confirmation,
            content: data.confirmationPrompt ?? "Would you like me to proceed with this action?",
            timestamp: Date(),
            pendingAction: pendingAction
        )
        messages.append(confirmationMessage)
    }
    
    private func handleActionCompleted(_ response: TextCommandResponse) async {
        guard let data = response.data else { return }
        
        // Add completion message to chat
        let completionMessage = ChatMessage(
            id: UUID().uuidString,
            type: .result,
            content: response.message,
            timestamp: Date(),
            toolResults: data.toolResults
        )
        messages.append(completionMessage)
        
        // Clear pending action
        pendingAction = nil
    }
    
    private func handleAuthRequired(_ response: TextCommandResponse) async {
        // Add auth required message to chat
        let authMessage = ChatMessage(
            id: UUID().uuidString,
            type: .error,
            content: "Authentication required. Please sign in with the required permissions.",
            timestamp: Date()
        )
        messages.append(authMessage)
    }
    
    private func handleError(_ error: Error) async {
        let errorMessage = ChatMessage(
            id: UUID().uuidString,
            type: .error,
            content: "Sorry, I encountered an error: \(error.localizedDescription)",
            timestamp: Date()
        )
        messages.append(errorMessage)
        
        self.errorMessage = error.localizedDescription
    }
    
    // MARK: - Action Confirmation
    
    func confirmAction(_ actionId: String, confirmed: Bool) async {
        guard let pendingAction = pendingAction,
              pendingAction.actionId == actionId,
              let apiService = apiService else {
            return
        }
        
        isLoading = true
        
        // Add user response to chat
        let userResponse = ChatMessage(
            id: UUID().uuidString,
            type: .user,
            content: confirmed ? "Yes, proceed" : "No, cancel",
            timestamp: Date()
        )
        messages.append(userResponse)
        
        do {
            let response = try await apiService.confirmAction(
                actionId: actionId,
                confirmed: confirmed,
                sessionId: sessionId
            )
            
            // Add result message to chat
            let resultMessage = ChatMessage(
                id: UUID().uuidString,
                type: .result,
                content: response.message,
                timestamp: Date()
            )
            messages.append(resultMessage)
            
            // Clear pending action
            self.pendingAction = nil
            
        } catch {
            await handleError(error)
        }
        
        isLoading = false
    }
    
    // MARK: - Utility Methods
    
    func clearMessages() {
        messages.removeAll()
        pendingAction = nil
        errorMessage = nil
    }
    
    var hasPendingAction: Bool {
        return pendingAction != nil
    }
}

// MARK: - Chat Message Model

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let type: MessageType
    let content: String
    let timestamp: Date
    let pendingAction: PendingAction?
    let toolResults: [ToolResult]?
    
    init(id: String, type: MessageType, content: String, timestamp: Date, pendingAction: PendingAction? = nil, toolResults: [ToolResult]? = nil) {
        self.id = id
        self.type = type
        self.content = content
        self.timestamp = timestamp
        self.pendingAction = pendingAction
        self.toolResults = toolResults
    }
    
    enum MessageType {
        case user
        case assistant
        case confirmation
        case result
        case error
        
        var isUser: Bool {
            return self == .user
        }
        
        var icon: String {
            switch self {
            case .user:
                return "person.circle.fill"
            case .assistant:
                return "brain.head.profile"
            case .confirmation:
                return "questionmark.circle.fill"
            case .result:
                return "checkmark.circle.fill"
            case .error:
                return "xmark.circle.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .user:
                return .blue
            case .assistant:
                return .purple
            case .confirmation:
                return .orange
            case .result:
                return .green
            case .error:
                return .red
            }
        }
    }
    
    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        return lhs.id == rhs.id
    }
}