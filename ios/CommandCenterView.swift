//
//  CommandCenterView.swift
//  AssistantApp
//
//  Main Command Center UI replacing TabView
//

import SwiftUI

struct CommandCenterView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @StateObject private var viewModel = CommandCenterViewModel()
    @FocusState private var isInputFocused: Bool
    @State private var showingSettings = false
    @State private var showingStats = false
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header Section
                    headerSection
                    
                    // Action Cards Section  
                    actionCardsSection
                    
                    // Command Input Section
                    commandInputSection
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                viewModel.setAuthManager(authManager)
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingSettings) {
                settingsSheet
            }
            .sheet(isPresented: $showingStats) {
                statsSheet
            }
            .sheet(isPresented: $viewModel.showingCardDetail) {
                if let selectedCard = viewModel.selectedCard {
                    ActionCardDetailView(card: selectedCard)
                }
            }
        }
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(spacing: 12) {
            HStack {
                // Profile Section
                Button(action: { showingSettings.toggle() }) {
                    HStack(spacing: 12) {
                        AsyncImage(url: URL(string: authManager.currentUser?.picture ?? "")) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.blue)
                        }
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                        
                        VStack(alignment: .leading, spacing: 2) {
                            if let user = authManager.currentUser {
                                Text(user.givenName ?? user.name)
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.primary)
                            }
                            
                            Text("Command Center")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                }
                .buttonStyle(PlainButtonStyle())
                
                // Stats Button
                Button(action: { showingStats.toggle() }) {
                    HStack(spacing: 6) {
                        Image(systemName: "chart.bar.fill")
                        Text("\(viewModel.stats.totalActions)")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(12)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            
            // Quick Stats Bar (if there are active actions)
            if !viewModel.activeCards.isEmpty {
                quickStatsBar
            }
        }
        .background(Color(.systemBackground))
    }
    
    private var quickStatsBar: some View {
        HStack(spacing: 16) {
            if viewModel.stats.pendingActions > 0 {
                StatChip(
                    icon: "clock.fill",
                    count: viewModel.stats.pendingActions,
                    label: "Pending",
                    color: .orange
                )
            }
            
            if viewModel.stats.executingActions > 0 {
                StatChip(
                    icon: "gearshape.fill",
                    count: viewModel.stats.executingActions,
                    label: "Running",
                    color: .blue
                )
            }
            
            if viewModel.stats.completedActions > 0 {
                StatChip(
                    icon: "checkmark.circle.fill",
                    count: viewModel.stats.completedActions,
                    label: "Done",
                    color: .green
                )
            }
            
            Spacer()
            
            // Clear completed button
            if viewModel.stats.completedActions > 0 {
                Button("Clear") {
                    withAnimation(.spring()) {
                        viewModel.clearCompletedActions()
                    }
                }
                .font(.caption)
                .foregroundColor(.blue)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
    
    // MARK: - Action Cards Section
    
    private var actionCardsSection: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if viewModel.displayedCards.isEmpty {
                    emptyStateView
                        .padding(.top, 80)
                } else {
                    ForEach(viewModel.displayedCards) { card in
                        ActionCardView(
                            card: card,
                            onApprove: { await viewModel.approveAction(card.id) },
                            onDismiss: { viewModel.dismissAction(card.id) },
                            onEdit: { newType in viewModel.editAction(card.id, newType: newType) },
                            onTap: { 
                                viewModel.selectedCard = card
                                viewModel.showingCardDetail = true
                            }
                        )
                        .padding(.horizontal, 16)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                    }
                    
                    // Bottom padding for input area
                    Color.clear
                        .frame(height: 120)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 48, weight: .light))
                .foregroundColor(.blue.opacity(0.6))
            
            VStack(spacing: 8) {
                Text("Ready for your command")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                Text("Type what you'd like to do and I'll propose the best actions")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            
            // Quick suggestion buttons
            VStack(spacing: 8) {
                Text("Try asking:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    SuggestionButton(text: "Send an email to...") {
                        viewModel.currentCommand = "Send an email to "
                        isInputFocused = true
                    }
                    
                    SuggestionButton(text: "Schedule a meeting") {
                        viewModel.currentCommand = "Schedule a meeting for "
                        isInputFocused = true
                    }
                    
                    SuggestionButton(text: "Find contact for...") {
                        viewModel.currentCommand = "Find contact for "
                        isInputFocused = true
                    }
                    
                    SuggestionButton(text: "Create a note") {
                        viewModel.currentCommand = "Create a note about "
                        isInputFocused = true
                    }
                }
                .padding(.horizontal, 20)
            }
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Command Input Section
    
    private var commandInputSection: some View {
        VStack(spacing: 12) {
            // Error message
            if let errorMessage = viewModel.errorMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                    
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Button("Dismiss") {
                        viewModel.errorMessage = nil
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
                .padding(.horizontal, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            
            // Processing indicator
            if viewModel.isProcessing {
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    
                    Text("Processing your request...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            
            // Input field
            HStack(spacing: 12) {
                TextField(
                    "What would you like me to do?",
                    text: $viewModel.currentCommand,
                    axis: .vertical
                )
                .textFieldStyle(CustomTextFieldStyle())
                .focused($isInputFocused)
                .onSubmit {
                    Task {
                        await viewModel.processCommand()
                    }
                }
                .disabled(viewModel.isProcessing)
                
                // Send button
                Button(action: {
                    Task {
                        await viewModel.processCommand()
                    }
                }) {
                    Image(systemName: viewModel.isProcessing ? "stop.circle.fill" : "paperplane.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(
                            Circle()
                                .fill(sendButtonColor)
                        )
                }
                .disabled(viewModel.currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !viewModel.isProcessing)
                .animation(.easeInOut(duration: 0.2), value: viewModel.isProcessing)
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 16)
        .background(
            Color(.systemBackground)
                .shadow(color: .black.opacity(0.1), radius: 1, x: 0, y: -1)
        )
    }
    
    private var sendButtonColor: Color {
        if viewModel.isProcessing {
            return .red
        } else if viewModel.currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return .gray
        } else {
            return .blue
        }
    }
}

// MARK: - Supporting Views

struct StatChip: View {
    let icon: String
    let count: Int
    let label: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text("\(count)")
                .font(.caption2)
                .fontWeight(.semibold)
            Text(label)
                .font(.caption2)
        }
        .foregroundColor(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct SuggestionButton: View {
    let text: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.blue)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
        }
    }
}

struct CustomTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color(.systemGray4), lineWidth: 1)
            )
    }
}

// MARK: - Sheets and Modals

extension CommandCenterView {
    private var settingsSheet: some View {
        NavigationView {
            VStack {
                Text("Settings")
                    .font(.title)
                    .padding()
                
                Spacer()
                
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
                .cornerRadius(12)
                .padding(.horizontal)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        showingSettings = false
                    }
                }
            }
        }
    }
    
    private var statsSheet: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Statistics")
                    .font(.title)
                    .padding()
                
                VStack(alignment: .leading, spacing: 16) {
                    StatRow(title: "Total Actions", value: "\(viewModel.stats.totalActions)")
                    StatRow(title: "Pending Actions", value: "\(viewModel.stats.pendingActions)")
                    StatRow(title: "Executing Actions", value: "\(viewModel.stats.executingActions)")
                    StatRow(title: "Completed Actions", value: "\(viewModel.stats.completedActions)")
                    StatRow(title: "Failed Actions", value: "\(viewModel.stats.failedActions)")
                    StatRow(title: "Success Rate", value: String(format: "%.1f%%", viewModel.stats.successRate * 100))
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .navigationTitle("Stats")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        showingStats = false
                    }
                }
            }
        }
    }
}

struct StatRow: View {
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Text(title)
                .font(.body)
            Spacer()
            Text(value)
                .font(.body)
                .fontWeight(.semibold)
        }
        .padding(.vertical, 4)
    }
}

struct ActionCardDetailView: View {
    let card: ActionCard
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        Image(systemName: card.icon)
                            .font(.title)
                            .foregroundColor(card.color)
                        
                        VStack(alignment: .leading) {
                            Text(card.title)
                                .font(.title2)
                                .fontWeight(.bold)
                            Text(card.subtitle)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                    .padding()
                    
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Details")
                            .font(.headline)
                        
                        Text(card.detailContent)
                            .font(.body)
                    }
                    .padding()
                    
                    Spacer()
                }
            }
            .navigationTitle("Action Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        // Close modal
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CommandCenterView_Previews: PreviewProvider {
    static var previews: some View {
        CommandCenterView()
            .environmentObject(AuthenticationManager())
    }
}
#endif