//
//  SignInView.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import SwiftUI
import GoogleSignIn

struct SignInView: View {
    @EnvironmentObject var authManager: AuthManager
    
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            // App Logo/Title
            VStack(spacing: 16) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)
                
                Text("Assistant App")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Your AI-powered personal assistant")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            Spacer()
            
            // Sign In Button
            VStack(spacing: 16) {
                if authManager.isLoading {
                    ProgressView("Signing in...")
                        .frame(height: 50)
                } else {
                    Button(action: {
                        Task {
                            await authManager.signIn()
                        }
                    }) {
                        HStack {
                            Image(systemName: "person.circle.fill")
                            Text("Sign in with Google")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.blue)
                        .cornerRadius(10)
                    }
                }
                
                // Error Message
                if let errorMessage = authManager.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
            }
            .padding(.horizontal, 32)
            
            Spacer()
        }
        .padding()
    }
}

#Preview {
    SignInView()
        .environmentObject(AuthManager())
}