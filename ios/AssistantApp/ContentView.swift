//
//  ContentView.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import SwiftUI
import GoogleSignIn

struct ContentView: View {
    @StateObject private var authManager = AuthManager()
    
    var body: some View {
        Group {
            if authManager.isSignedIn {
                ChatView()
                    .environmentObject(authManager)
            } else {
                SignInView()
                    .environmentObject(authManager)
            }
        }
    }
}

#Preview {
    ContentView()
}