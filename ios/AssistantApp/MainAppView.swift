//
//  MainAppView.swift
//  AssistantApp
//
//  Created by Edward Zhong on 8/18/25.
//

import SwiftUI

struct MainAppView: View {
    @StateObject private var authManager = AuthenticationManager()
    
    var body: some View {
        Group {
            if authManager.isSignedIn {
                // Main authenticated app content
                AuthenticatedMainView()
                    .environmentObject(authManager)
            } else {
                // Sign-in flow
                SignInView()
                    .environmentObject(authManager)
            }
        }
        .onAppear {
            // Check authentication state when app starts
        }
    }
}

// MARK: - Authenticated Main View
struct AuthenticatedMainView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            
            // Dashboard Tab
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Dashboard")
                }
                .tag(0)
            
            // Chat Tab
            ChatView()
                .tabItem {
                    Image(systemName: "message.fill")
                    Text("Chat")
                }
                .tag(1)
            
            // Calendar Tab
            CalendarView()
                .tabItem {
                    Image(systemName: "calendar")
                    Text("Calendar")
                }
                .tag(2)
            
            // Profile Tab
            ProfileView()
                .tabItem {
                    Image(systemName: "person.circle.fill")
                    Text("Profile")
                }
                .tag(3)
        }
        .accentColor(.blue)
    }
}

// MARK: - Dashboard View
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var dashboardData: DashboardData?
    @State private var isLoading = true
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    
                    // Welcome Section
                    if let user = authManager.currentUser {
                        WelcomeCard(user: user)
                    }
                    
                    // Quick Actions
                    QuickActionsSection()
                    
                    // Recent Activity
                    RecentActivitySection()
                    
                    // Stats Overview
                    StatsOverviewSection()
                    
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .refreshable {
                await loadDashboardData()
            }
            .task {
                await loadDashboardData()
            }
        }
    }
    
    private func loadDashboardData() async {
        isLoading = true
        
        do {
            let data = try await authManager.makeAuthenticatedRequest(to: "/protected/dashboard")
            // Parse dashboard data here
            
            await MainActor.run {
                // Update UI with dashboard data
                isLoading = false
            }
        } catch {
            print("Failed to load dashboard data: \(error)")
            await MainActor.run {
                isLoading = false
            }
        }
    }
}

// MARK: - Welcome Card
struct WelcomeCard: View {
    let user: AppUser
    
    var body: some View {
        HStack {
            AsyncImage(url: URL(string: user.picture ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.gray)
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Good morning, \(user.givenName ?? user.name)!")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Ready to be productive today?")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Quick Actions Section
struct QuickActionsSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                QuickActionCard(icon: "plus.message", title: "New Chat", color: .blue) {
                    // Navigate to new chat
                }
                
                QuickActionCard(icon: "calendar.badge.plus", title: "Add Event", color: .green) {
                    // Navigate to add calendar event
                }
                
                QuickActionCard(icon: "envelope", title: "Check Email", color: .orange) {
                    // Navigate to email
                }
                
                QuickActionCard(icon: "doc.text", title: "Take Notes", color: .purple) {
                    // Navigate to notes
                }
            }
        }
    }
}

// MARK: - Quick Action Card
struct QuickActionCard: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Recent Activity Section
struct RecentActivitySection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                ActivityRow(icon: "message.fill", title: "Chat with AI Assistant", time: "5 minutes ago")
                ActivityRow(icon: "calendar", title: "Meeting scheduled", time: "1 hour ago")
                ActivityRow(icon: "envelope", title: "Email sent", time: "2 hours ago")
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
    }
}

// MARK: - Activity Row
struct ActivityRow: View {
    let icon: String
    let title: String
    let time: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.blue)
                .frame(width: 25)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                
                Text(time)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Stats Overview Section
struct StatsOverviewSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Overview")
                .font(.headline)
                .fontWeight(.semibold)
            
            HStack(spacing: 12) {
                StatCard(title: "Chats", value: "24", color: .blue)
                StatCard(title: "Events", value: "8", color: .green)
                StatCard(title: "Tasks", value: "12", color: .orange)
            }
        }
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Chat View
struct ChatView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @StateObject private var chatViewModel = ChatViewModel()
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Messages List
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(chatViewModel.messages) { message in
                                MessageBubbleView(message: message) { actionId, confirmed in
                                    Task {
                                        await chatViewModel.confirmAction(actionId, confirmed: confirmed)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                    .onChange(of: chatViewModel.messages.count) { _ in
                        if let lastMessage = chatViewModel.messages.last {
                            withAnimation(.easeOut(duration: 0.3)) {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                // Input Area
                VStack(spacing: 12) {
                    if chatViewModel.isLoading {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Assistant is thinking...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal)
                    }
                    
                    if let errorMessage = chatViewModel.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal)
                    }
                    
                    HStack(spacing: 12) {
                        TextField("Type your command...", text: $chatViewModel.currentCommand, axis: .vertical)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($isTextFieldFocused)
                            .onSubmit {
                                Task {
                                    await chatViewModel.sendCommand()
                                }
                            }
                        
                        Button(action: {
                            Task {
                                await chatViewModel.sendCommand()
                            }
                        }) {
                            Image(systemName: "paperplane.fill")
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                                .background(
                                    Circle()
                                        .fill(chatViewModel.currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : Color.blue)
                                )
                        }
                        .disabled(chatViewModel.currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chatViewModel.isLoading)
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
                .background(Color(.systemGroupedBackground))
            }
            .navigationTitle("Assistant Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("New Session") {
                            chatViewModel.startNewSession()
                        }
                        
                        Button("Clear Messages") {
                            chatViewModel.clearMessages()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .onAppear {
            chatViewModel.setAuthManager(authManager)
        }
    }
}

struct CalendarView: View {
    var body: some View {
        NavigationView {
            Text("Calendar View - Coming Soon")
                .navigationTitle("Calendar")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                if let user = authManager.currentUser {
                    
                    // Profile Header
                    VStack(spacing: 16) {
                        AsyncImage(url: URL(string: user.picture ?? "")) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 80))
                                .foregroundColor(.gray)
                        }
                        .frame(width: 100, height: 100)
                        .clipShape(Circle())
                        
                        VStack(spacing: 4) {
                            Text(user.name)
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text(user.email)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.top, 20)
                    
                    Spacer()
                    
                    // Sign Out Button
                    Button("Sign Out") {
                        Task {
                            await authManager.signOut()
                        }
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.red)
                    .cornerRadius(10)
                    .padding(.horizontal)
                    .padding(.bottom, 50)
                }
            }
            .navigationTitle("Profile")
        }
    }
}

// MARK: - Dashboard Data Model
struct DashboardData: Codable {
    let welcomeMessage: String
    let recentActivity: [ActivityItem]
    let stats: Stats
}

struct ActivityItem: Codable, Identifiable {
    let id: String
    let title: String
    let timestamp: String
    let type: String
}

struct Stats: Codable {
    let chats: Int
    let events: Int
    let tasks: Int
}

// MARK: - Preview
#Preview {
    MainAppView()
}