//
//  SignInView.swift
//  AssistantApp
//
//  Created by Edward Zhong on 8/18/25.
//

import SwiftUI
import GoogleSignIn

struct SignInView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                
                // App Logo and Title
                VStack(spacing: 20) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    
                    Text("Assistant App")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Your personal AI assistant")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 50)
                
                Spacer()
                
                // Sign-in content based on auth state
                Group {
                    switch authManager.authState {
                    case .signedOut:
                        signInContent
                        
                    case .loading:
                        loadingContent
                        
                    case .signedIn(let user):
                        signedInContent(user: user)
                        
                    case .error(let message):
                        errorContent(message: message)
                    }
                }
                
                Spacer()
                
                // Footer
                Text("Secure authentication powered by Google")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.bottom, 20)
            }
            .padding(.horizontal, 30)
            .navigationTitle("")
            .navigationBarHidden(true)
        }
    }
    
    // MARK: - Sign In Content
    private var signInContent: some View {
        VStack(spacing: 20) {
            Text("Sign in to continue")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Access your personalized AI assistant with secure Google authentication")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            
            // Google Sign-In Button
            GoogleSignInButton()
                .frame(height: 50)
                .cornerRadius(8)
                .onTapGesture {
                    Task {
                        await authManager.signIn()
                    }
                }
            
            // Features list
            VStack(alignment: .leading, spacing: 12) {
                FeatureRow(icon: "lock.shield", text: "Secure authentication")
                FeatureRow(icon: "cloud", text: "Cloud synchronization")
                FeatureRow(icon: "person.circle", text: "Personalized experience")
            }
            .padding(.top, 20)
        }
    }
    
    // MARK: - Loading Content
    private var loadingContent: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            
            Text("Signing you in...")
                .font(.title3)
                .foregroundColor(.secondary)
        }
    }
    
    // MARK: - Signed In Content
    private func signedInContent(user: AppUser) -> some View {
        VStack(spacing: 20) {
            // User profile
            AsyncImage(url: URL(string: user.picture ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.gray)
            }
            .frame(width: 80, height: 80)
            .clipShape(Circle())
            
            VStack(spacing: 8) {
                Text("Welcome, \(user.givenName ?? user.name)!")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text(user.email)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            // Success message
            VStack(spacing: 12) {
                Text("Successfully signed in!")
                    .font(.headline)
                    .foregroundColor(.green)
                
                Text("Taking you to your assistant...")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                ProgressView()
                    .scaleEffect(0.8)
                    .padding(.top, 8)
            }
        }
    }
    
    // MARK: - Error Content
    private func errorContent(message: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 50))
                .foregroundColor(.red)
            
            Text("Sign-in Failed")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            
            Button("Try Again") {
                Task {
                    await authManager.signIn()
                }
            }
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue)
            .cornerRadius(10)
        }
    }
}

// MARK: - Feature Row Component
struct FeatureRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.blue)
                .frame(width: 20)
            
            Text(text)
                .font(.body)
                .foregroundColor(.primary)
            
            Spacer()
        }
    }
}

// MARK: - Google Sign-In Button
struct GoogleSignInButton: View {
    var body: some View {
        HStack {
            Image("google_logo") // You'll need to add Google logo to assets
                .resizable()
                .frame(width: 24, height: 24)
            
            Text("Continue with Google")
                .font(.headline)
                .fontWeight(.medium)
        }
        .foregroundColor(.black)
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Preview
#Preview {
    SignInView()
}