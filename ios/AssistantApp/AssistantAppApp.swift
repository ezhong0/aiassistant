//
//  AssistantAppApp.swift
//  AssistantApp
//
//  Created by Edward Zhong on 8/18/25.
//

import SwiftUI
import GoogleSignIn

@main
struct AssistantAppApp: App {
    
    init() {
        configureGoogleSignIn()
    }
    
    var body: some Scene {
        WindowGroup {
            MainAppView()
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
    
    private func configureGoogleSignIn() {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let clientID = plist["CLIENT_ID"] as? String else {
            fatalError("GoogleService-Info.plist not found or CLIENT_ID missing")
        }
        
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }
}
