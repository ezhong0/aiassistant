//
//  MessageBubbleView.swift
//  AssistantApp
//
//  Created by Assistant on 8/21/25.
//

import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage
    let onActionConfirmation: (String, Bool) -> Void
    
    var body: some View {
        HStack {
            if message.type.isUser {
                Spacer()
            }
            
            VStack(alignment: message.type.isUser ? .trailing : .leading, spacing: 8) {
                // Message Header
                HStack(spacing: 8) {
                    if !message.type.isUser {
                        Image(systemName: message.type.icon)
                            .foregroundColor(message.type.color)
                            .font(.caption)
                    }
                    
                    Text(message.type.isUser ? "You" : messageTypeLabel)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(message.type.color)
                    
                    Spacer()
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                // Message Content
                Text(message.content)
                    .font(.body)
                    .foregroundColor(message.type.isUser ? .white : .primary)
                    .multilineTextAlignment(message.type.isUser ? .trailing : .leading)
                
                // Action Details (for confirmation messages)
                if let pendingAction = message.pendingAction {
                    ActionDetailsView(action: pendingAction)
                }
                
                // Tool Results (for completed actions)
                if let toolResults = message.toolResults {
                    ToolResultsView(results: toolResults)
                }
                
                // Confirmation Buttons
                if message.type == .confirmation, let pendingAction = message.pendingAction {
                    ConfirmationButtonsView(actionId: pendingAction.actionId, onConfirmation: onActionConfirmation)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(message.type.isUser ? Color.blue : Color(.systemGray6))
            )
            .frame(maxWidth: UIScreen.main.bounds.width * 0.8, alignment: message.type.isUser ? .trailing : .leading)
            
            if !message.type.isUser {
                Spacer()
            }
        }
    }
    
    private var messageTypeLabel: String {
        switch message.type {
        case .user:
            return "You"
        case .assistant:
            return "Assistant"
        case .confirmation:
            return "Confirm Action"
        case .result:
            return "Result"
        case .error:
            return "Error"
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Action Details View
struct ActionDetailsView: View {
    let action: PendingAction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "gear.circle.fill")
                    .foregroundColor(.blue)
                Text("Proposed Action")
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Type:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(action.type)
                        .font(.caption)
                        .fontWeight(.medium)
                    Spacer()
                }
                
                if !action.parameters.isEmpty {
                    ForEach(Array(action.parameters.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text("\(key.capitalized):")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(formatParameterValue(action.parameters[key]))
                                .font(.caption)
                                .fontWeight(.medium)
                            Spacer()
                        }
                    }
                }
            }
            .padding(8)
            .background(Color(.systemGray5))
            .cornerRadius(8)
        }
    }
    
    private func formatParameterValue(_ value: AnyCodable?) -> String {
        // Simple string representation of the parameter value
        return String(describing: value).replacingOccurrences(of: "AnyCodable(", with: "").replacingOccurrences(of: ")", with: "")
    }
}

// MARK: - Tool Results View
struct ToolResultsView: View {
    let results: [ToolResult]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("Execution Results")
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            ForEach(Array(results.enumerated()), id: \.offset) { index, result in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: result.success ? "checkmark.circle" : "xmark.circle")
                            .foregroundColor(result.success ? .green : .red)
                            .font(.caption)
                        
                        Text(result.toolName)
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        if let executionTime = result.executionTime {
                            Text("\(executionTime)ms")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    if let error = result.error {
                        Text("Error: \(error)")
                            .font(.caption2)
                            .foregroundColor(.red)
                    }
                }
                .padding(6)
                .background(Color(.systemGray5))
                .cornerRadius(6)
            }
        }
    }
}

// MARK: - Confirmation Buttons View
struct ConfirmationButtonsView: View {
    let actionId: String
    let onConfirmation: (String, Bool) -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Button(action: {
                onConfirmation(actionId, false)
            }) {
                HStack {
                    Image(systemName: "xmark")
                    Text("Cancel")
                }
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.red)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.red, lineWidth: 1)
                )
            }
            
            Button(action: {
                onConfirmation(actionId, true)
            }) {
                HStack {
                    Image(systemName: "checkmark")
                    Text("Confirm")
                }
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.green)
                )
            }
        }
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 16) {
        MessageBubbleView(
            message: ChatMessage(
                id: "1",
                type: .user,
                content: "Send an email to john about the meeting",
                timestamp: Date()
            ),
            onActionConfirmation: { _, _ in }
        )
        
        MessageBubbleView(
            message: ChatMessage(
                id: "2",
                type: .assistant,
                content: "I'll help you send an email to John about the meeting.",
                timestamp: Date()
            ),
            onActionConfirmation: { _, _ in }
        )
        
        MessageBubbleView(
            message: ChatMessage(
                id: "3",
                type: .confirmation,
                content: "I'm about to send an email to john@example.com. Would you like me to proceed?",
                timestamp: Date(),
                pendingAction: PendingAction(
                    actionId: "test-123",
                    type: "emailAgent",
                    parameters: [
                        "to": AnyCodable("john@example.com"),
                        "subject": AnyCodable("Meeting Discussion")
                    ],
                    awaitingConfirmation: true
                )
            ),
            onActionConfirmation: { _, _ in }
        )
    }
    .padding()
}