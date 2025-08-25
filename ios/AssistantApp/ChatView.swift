//
//  ChatView.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import SwiftUI

struct ChatView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = ChatViewModel()
    @State private var messageText = ""
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        NavigationView {
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
                }
                .padding()
                .background(Color(.systemGroupedBackground))
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
    
    private func sendMessage() {
        let trimmedMessage = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        
        Task {
            await viewModel.sendMessage(trimmedMessage)
            await MainActor.run {
                messageText = ""
            }
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

#Preview {
    ChatView()
        .environmentObject(AuthManager())
}