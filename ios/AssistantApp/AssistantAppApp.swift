//
//  AssistantAppApp.swift
//  AssistantApp
//
//  Created by Assistant on 8/23/25.
//

import SwiftUI
import GoogleSignIn

@main
struct AssistantAppApp: App {
    
    init() {
        // Configure Google Sign-In
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let plist = NSDictionary(contentsOfFile: path),
           let clientId = plist["CLIENT_ID"] as? String {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}