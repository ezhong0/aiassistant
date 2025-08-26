//
//  AuthManager.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import Foundation
import GoogleSignIn
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isSignedIn = false
    @Published var user: GIDGoogleUser?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var jwtToken: String?
    private let baseURL = "http://localhost:3000"
    
    init() {
        checkSignInStatus()
    }
    
    func checkSignInStatus() {
        if let user = GIDSignIn.sharedInstance.currentUser {
            self.user = user
            self.isSignedIn = true
        }
    }
    
    func signIn() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            await MainActor.run {
                self.errorMessage = "Could not find root view controller"
            }
            return
        }
        
        await MainActor.run {
            self.isLoading = true
            self.errorMessage = nil
        }
        
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)
            let googleUser = result.user
            
            // Exchange Google token for JWT
            let accessToken = googleUser.accessToken.tokenString
            let jwt = try await exchangeTokenForJWT(accessToken: accessToken)
            
            await MainActor.run {
                self.user = googleUser
                self.isSignedIn = true
                self.jwtToken = jwt
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Sign in failed: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }
    
    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        self.user = nil
        self.isSignedIn = false
        self.jwtToken = nil
        self.errorMessage = nil
    }
    
    private func exchangeTokenForJWT(accessToken: String) async throws -> String {
        let url = URL(string: "\(baseURL)/auth/exchange-mobile-tokens")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "access_token": accessToken,
            "platform": "ios"
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthError.tokenExchangeFailed
        }
        
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let jwt = json?["jwt"] as? String else {
            throw AuthError.invalidResponse
        }
        
        return jwt
    }
    
    func getAuthToken() -> String? {
        return jwtToken
    }
    
    func getGoogleAccessToken() -> String? {
        return user?.accessToken.tokenString
    }
}

enum AuthError: LocalizedError {
    case tokenExchangeFailed
    case invalidResponse
    
    var errorDescription: String? {
        switch self {
        case .tokenExchangeFailed:
            return "Failed to exchange token with server"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}