//
//  AuthenticationManager.swift
//  AssistantApp
//
//  Created by Edward Zhong on 8/18/25.
//

import Foundation
import GoogleSignIn
import SwiftUI

// MARK: - User Model
struct AppUser: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let picture: String?
    let givenName: String?
    let familyName: String?
    
    init(from googleUser: GIDGoogleUser) {
        self.id = googleUser.userID ?? ""
        self.email = googleUser.profile?.email ?? ""
        self.name = googleUser.profile?.name ?? ""
        self.picture = googleUser.profile?.imageURL(withDimension: 200)?.absoluteString
        self.givenName = googleUser.profile?.givenName
        self.familyName = googleUser.profile?.familyName
    }
}

// MARK: - Authentication State
enum AuthenticationState {
    case signedOut
    case signedIn(AppUser)
    case loading
    case error(String)
}

// MARK: - Token Information
struct TokenInfo {
    let accessToken: String
    let refreshToken: String?
    let idToken: String?
    let expirationDate: Date?
}

// MARK: - Authentication Manager
@MainActor
class AuthenticationManager: ObservableObject {
    @Published var authState: AuthenticationState = .signedOut
    @Published var isLoading = false
    
    private let config = AppConfiguration.shared
    
    init() {
        setupGoogleSignIn()
        checkCurrentUser()
    }
    
    // MARK: - Setup
    private func setupGoogleSignIn() {
        // Use client ID from configuration
        let clientID = config.googleClientID
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        
        if config.enableDebugLogs {
            print("🔧 Google Sign-In configured with Client ID: \(clientID.prefix(20))...")
            print("🔧 Environment: \(config.environmentName)")
            print("🔧 Backend URL: \(config.backendBaseURL)")
        }
    }
    
    // MARK: - Check Current User
    private func checkCurrentUser() {
        if let user = GIDSignIn.sharedInstance.currentUser {
            let appUser = AppUser(from: user)
            authState = .signedIn(appUser)
        } else {
            authState = .signedOut
        }
    }
    
    // MARK: - Sign In
    func signIn() async {
        await MainActor.run {
            isLoading = true
            authState = .loading
        }
        
        do {
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let rootViewController = windowScene.windows.first?.rootViewController else {
                throw AuthError.noViewController
            }
            
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)
            let googleUser = result.user
            
            // Get tokens
            let accessToken = googleUser.accessToken.tokenString
            
            // Send tokens to backend for validation and JWT generation
            let jwtToken = try await exchangeTokensWithBackend(
                accessToken: accessToken,
                refreshToken: googleUser.refreshToken.tokenString,
                idToken: googleUser.idToken?.tokenString
            )
            
            // Store JWT token securely
            try storeJWTToken(jwtToken)
            
            // Update UI state
            let appUser = AppUser(from: googleUser)
            await MainActor.run {
                self.authState = .signedIn(appUser)
                self.isLoading = false
            }
            
            if config.enableDebugLogs {
                print("✅ Sign-in successful for: \(appUser.email)")
                print("🔧 Using backend: \(config.backendBaseURL)")
            }
            
        } catch {
            await MainActor.run {
                self.authState = .error(error.localizedDescription)
                self.isLoading = false
            }
            print("❌ Sign-in error: \(error)")
        }
    }
    
    // MARK: - Sign Out
    func signOut() async {
        await MainActor.run {
            isLoading = true
        }
        
        do {
            // Sign out from Google
            GIDSignIn.sharedInstance.signOut()
            
            // Notify backend of logout
            if let jwtToken = getStoredJWTToken() {
                try await notifyBackendLogout(jwtToken: jwtToken)
            }
            
            // Clear stored tokens
            clearStoredTokens()
            
            await MainActor.run {
                self.authState = .signedOut
                self.isLoading = false
            }
            
            if config.enableDebugLogs {
                print("✅ Sign-out successful")
            }
            
        } catch {
            await MainActor.run {
                self.authState = .error("Sign-out failed: \(error.localizedDescription)")
                self.isLoading = false
            }
            print("❌ Sign-out error: \(error)")
        }
    }
    
    // MARK: - Refresh Tokens
    func refreshTokensIfNeeded() async -> Bool {
        guard let currentUser = GIDSignIn.sharedInstance.currentUser else {
            return false
        }
        
        do {
            try await currentUser.refreshTokensIfNeeded()
            
            let accessToken = currentUser.accessToken.tokenString
            
            // Update backend with new tokens if needed
            do {
                let jwtToken = try await self.exchangeTokensWithBackend(
                    accessToken: accessToken,
                    refreshToken: currentUser.refreshToken.tokenString,
                    idToken: currentUser.idToken?.tokenString
                )
                try self.storeJWTToken(jwtToken)
            } catch {
                print("❌ Token refresh backend update failed: \(error)")
            }
            
            return true
        } catch {
            print("❌ Token refresh failed: \(error)")
            return false
        }
    }
    
    // MARK: - Backend Communication
    private func exchangeTokensWithBackend(accessToken: String, refreshToken: String?, idToken: String?) async throws -> String {
        let url = config.authURL(for: "exchange-mobile-tokens")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = config.apiTimeout
        
        let requestBody = [
            "access_token": accessToken,
            "refresh_token": refreshToken ?? "",
            "id_token": idToken ?? "",
            "platform": "ios"
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AuthError.backendError(errorMessage)
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let jwtToken = json["jwt"] as? String else {
            throw AuthError.noJWTToken
        }
        
        return jwtToken
    }
    
    private func notifyBackendLogout(jwtToken: String) async throws {
        let url = config.authURL(for: "logout")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = config.apiTimeout
        
        let requestBody = ["everywhere": true]
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            print("⚠️ Backend logout notification failed, continuing with local logout")
            return
        }
    }
    
    // MARK: - Token Storage
    private func storeJWTToken(_ token: String) throws {
        let data = token.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token",
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthError.keychainError
        }
    }
    
    private func getStoredJWTToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    private func clearStoredTokens() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token"
        ]
        
        SecItemDelete(query as CFDictionary)
    }
    
    // MARK: - API Requests
    func makeAuthenticatedRequest(to endpoint: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
        guard let jwtToken = getStoredJWTToken() else {
            throw AuthError.noJWTToken
        }
        
        let url = config.apiURL(for: endpoint)
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = config.apiTimeout
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            // Token expired, try to refresh
            if await refreshTokensIfNeeded() {
                // Retry the request with new token
                return try await makeAuthenticatedRequest(to: endpoint, method: method, body: body)
            } else {
                // Refresh failed, sign out
                await signOut()
                throw AuthError.tokenExpired
            }
        }
        
        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AuthError.backendError(errorMessage)
        }
        
        return data
    }
}

// MARK: - Auth Errors
enum AuthError: LocalizedError {
    case noViewController
    case noAccessToken
    case noJWTToken
    case invalidURL
    case invalidResponse
    case backendError(String)
    case keychainError
    case tokenExpired
    
    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "No view controller available for sign-in"
        case .noAccessToken:
            return "No access token received"
        case .noJWTToken:
            return "No JWT token received from backend"
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .backendError(let message):
            return "Backend error: \(message)"
        case .keychainError:
            return "Failed to store token securely"
        case .tokenExpired:
            return "Authentication token expired"
        }
    }
}

// MARK: - Convenience Extensions
extension AuthenticationManager {
    var isSignedIn: Bool {
        if case .signedIn = authState {
            return true
        }
        return false
    }
    
    var currentUser: AppUser? {
        if case .signedIn(let user) = authState {
            return user
        }
        return nil
    }
    
    var errorMessage: String? {
        if case .error(let message) = authState {
            return message
        }
        return nil
    }
    
    /// Returns current configuration information for debugging
    var configurationInfo: String {
        return config.configurationSummary
    }
    
    /// Returns whether debug features should be shown
    var shouldShowDebugInfo: Bool {
        return config.shouldShowDebugUI
    }
    
    /// Get current Google access token for API calls
    var googleAccessToken: String? {
        return GIDSignIn.sharedInstance.currentUser?.accessToken.tokenString
    }
}