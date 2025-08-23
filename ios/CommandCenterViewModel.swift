//
//  CommandCenterViewModel.swift
//  AssistantApp
//
//  Command Center ViewModel following MVVM pattern
//

import Foundation
import SwiftUI
import Combine

@MainActor
class CommandCenterViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var actionCards: [ActionCard] = []
    @Published var currentCommand: String = ""
    @Published var isProcessing: Bool = false
    @Published var errorMessage: String?
    @Published var selectedCard: ActionCard?
    @Published var showingCardDetail: Bool = false
    
    // UI State
    @Published var searchText: String = ""
    @Published var filterStatus: ActionStatus? = nil
    @Published var sortBy: SortOption = .timestamp
    
    // MARK: - Private Properties
    
    private var authManager: AuthenticationManager?
    private var cancellables = Set<AnyCancellable>()
    private let sessionId = "ios-session-\(UUID().uuidString)"
    
    // Configuration
    private let maxVisibleCards = 10
    private let cardAutoRemoveDelay: TimeInterval = 5.0
    
    // MARK: - Computed Properties
    
    /// Filtered and sorted action cards for display
    var displayedCards: [ActionCard] {
        let filtered = actionCards
            .filter { card in
                // Status filter
                if let filterStatus = filterStatus, card.status != filterStatus {
                    return false
                }
                
                // Search filter
                if !searchText.isEmpty {
                    return card.title.localizedCaseInsensitiveContains(searchText) ||
                           card.subtitle.localizedCaseInsensitiveContains(searchText)
                }
                
                return true
            }
        
        // Apply sorting
        let sorted = filtered.sorted { lhs, rhs in
            switch sortBy {
            case .timestamp:
                return lhs.timestamp > rhs.timestamp
            case .priority:
                return lhs.priority > rhs.priority
            case .status:
                return lhs.status.rawValue < rhs.status.rawValue
            case .type:
                return lhs.title < rhs.title
            }
        }
        
        // Limit visible cards to prevent UI overflow
        return Array(sorted.prefix(maxVisibleCards))
    }
    
    /// Active cards (not completed, failed, or dismissed)
    var activeCards: [ActionCard] {
        actionCards.filter { $0.status.isActive }
    }
    
    /// Statistics for dashboard
    var stats: CommandCenterStats {
        let total = actionCards.count
        let pending = actionCards.filter { $0.status == .pending }.count
        let executing = actionCards.filter { $0.status == .executing }.count
        let completed = actionCards.filter { $0.status == .completed }.count
        let failed = actionCards.filter { $0.status == .failed }.count
        
        return CommandCenterStats(
            totalActions: total,
            pendingActions: pending,
            executingActions: executing,
            completedActions: completed,
            failedActions: failed,
            successRate: total > 0 ? Double(completed) / Double(total) : 0.0
        )
    }
    
    // MARK: - Initialization
    
    init() {
        setupBindings()
        loadMockData() // For development
    }
    
    func setAuthManager(_ authManager: AuthenticationManager) {
        self.authManager = authManager
    }
    
    // MARK: - Public Methods
    
    /// Process user command and generate action cards
    func processCommand() async {
        guard !currentCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        
        let command = currentCommand
        currentCommand = "" // Clear input immediately for better UX
        
        isProcessing = true
        errorMessage = nil
        
        do {
            // Send command to backend
            guard let authManager = authManager else {
                throw CommandCenterError.notAuthenticated
            }
            
            let response = try await sendCommandToBackend(command: command, authManager: authManager)
            
            // Convert backend response to action cards
            let newCards = try convertResponseToActionCards(response)
            
            // Add new cards to the top of the list
            withAnimation(.spring()) {
                actionCards.insert(contentsOf: newCards, at: 0)
            }
            
            // Auto-scroll to new cards if needed
            if let firstCard = newCards.first {
                selectedCard = firstCard
            }
            
        } catch {
            errorMessage = error.localizedDescription
            
            // For development: Create mock action cards
            if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
                let mockCard = createMockActionCard(for: command)
                withAnimation(.spring()) {
                    actionCards.insert(mockCard, at: 0)
                }
            }
        }
        
        isProcessing = false
    }
    
    /// Approve an action card
    func approveAction(_ cardId: UUID) async {
        guard let index = actionCards.firstIndex(where: { $0.id == cardId }) else { return }
        guard actionCards[index].canBeApproved else { return }
        
        // Update card status
        withAnimation(.easeInOut) {
            actionCards[index] = actionCards[index].updating(status: .approved)
        }
        
        // Execute the action
        await executeAction(cardId)
    }
    
    /// Execute an approved action
    func executeAction(_ cardId: UUID) async {
        guard let index = actionCards.firstIndex(where: { $0.id == cardId }) else { return }
        
        // Update status to executing
        withAnimation(.easeInOut) {
            actionCards[index] = actionCards[index].updating(status: .executing)
        }
        
        do {
            // Send execution request to backend
            let success = try await executeActionOnBackend(actionCards[index])
            
            // Update final status
            let finalStatus: ActionStatus = success ? .completed : .failed
            withAnimation(.easeInOut) {
                actionCards[index] = actionCards[index].updating(status: finalStatus)
            }
            
            // Auto-remove completed cards after delay
            if success {
                DispatchQueue.main.asyncAfter(deadline: .now() + cardAutoRemoveDelay) {
                    withAnimation(.easeOut) {
                        self.actionCards.removeAll { $0.id == cardId }
                    }
                }
            }
            
        } catch {
            // Mark as failed
            withAnimation(.easeInOut) {
                actionCards[index] = actionCards[index].updating(status: .failed)
            }
            
            errorMessage = error.localizedDescription
        }
    }
    
    /// Dismiss an action card
    func dismissAction(_ cardId: UUID) {
        withAnimation(.easeOut) {
            if let index = actionCards.firstIndex(where: { $0.id == cardId }) {
                actionCards[index] = actionCards[index].updating(status: .dismissed)
            }
        }
        
        // Remove dismissed cards after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.actionCards.removeAll { $0.id == cardId }
        }
    }
    
    /// Edit an action card
    func editAction(_ cardId: UUID, newType: ActionType) {
        guard let index = actionCards.firstIndex(where: { $0.id == cardId }) else { return }
        guard actionCards[index].isEditable else { return }
        
        withAnimation(.easeInOut) {
            actionCards[index] = ActionCard(
                id: cardId,
                type: newType,
                status: .edited,
                aiConfidence: actionCards[index].aiConfidence,
                estimatedExecutionTime: actionCards[index].estimatedExecutionTime
            )
        }
    }
    
    /// Clear all completed and dismissed cards
    func clearCompletedActions() {
        withAnimation(.easeOut) {
            actionCards.removeAll { 
                $0.status == .completed || $0.status == .dismissed 
            }
        }
    }
    
    /// Refresh action cards (pull to refresh)
    func refresh() async {
        // In a real app, this would sync with backend state
        await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay for UX
        
        // For now, just clear error state
        errorMessage = nil
    }
    
    // MARK: - Private Methods
    
    private func setupBindings() {
        // Auto-clear errors after delay
        $errorMessage
            .compactMap { $0 }
            .debounce(for: .seconds(5), scheduler: DispatchQueue.main)
            .sink { _ in
                self.errorMessage = nil
            }
            .store(in: &cancellables)
    }
    
    private func loadMockData() {
        // For development and previews
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            actionCards = ActionCard.mockCards
        }
    }
    
    private func sendCommandToBackend(command: String, authManager: AuthenticationManager) async throws -> BackendResponse {
        let url = URL(string: "http://localhost:3000/api/assistant/text-command")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = [
            "command": command,
            "sessionId": sessionId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        // Add authentication
        if let token = authManager.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw CommandCenterError.networkError
        }
        
        return try JSONDecoder().decode(BackendResponse.self, from: data)
    }
    
    private func convertResponseToActionCards(_ response: BackendResponse) throws -> [ActionCard] {
        // Convert backend tool calls to action cards
        var cards: [ActionCard] = []
        
        for toolCall in response.toolCalls ?? [] {
            switch toolCall.name {
            case "emailAgent":
                if let emailCard = createEmailActionCard(from: toolCall) {
                    cards.append(emailCard)
                }
            case "calendarAgent":
                if let calendarCard = createCalendarActionCard(from: toolCall) {
                    cards.append(calendarCard)
                }
            case "contactAgent":
                if let contactCard = createContactActionCard(from: toolCall) {
                    cards.append(contactCard)
                }
            case "Think":
                // Think agent results don't create visible cards
                break
            default:
                // Handle other agents
                break
            }
        }
        
        return cards
    }
    
    private func executeActionOnBackend(_ actionCard: ActionCard) async throws -> Bool {
        // This would implement the actual execution logic
        // For now, simulate execution
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        return true
    }
    
    // Helper methods for creating action cards from backend responses
    private func createEmailActionCard(from toolCall: ToolCall) -> ActionCard? {
        // Extract email details from the tool call query parameter
        guard let query = toolCall.parameters["query"] else { return nil }
        
        // Use AI/NLP to extract email components from query
        let emailDetails = parseEmailQuery(query)
        
        return ActionCard(
            type: .sendEmail(
                recipient: emailDetails.recipient ?? "Unknown recipient",
                subject: emailDetails.subject ?? "Email from Assistant",
                body: emailDetails.body ?? query
            ),
            status: .pending,
            aiConfidence: 0.9
        )
    }
    
    private func createCalendarActionCard(from toolCall: ToolCall) -> ActionCard? {
        guard let query = toolCall.parameters["query"] else { return nil }
        
        let eventDetails = parseCalendarQuery(query)
        
        return ActionCard(
            type: .scheduleEvent(
                title: eventDetails.title ?? "Meeting",
                date: eventDetails.date ?? Date().addingTimeInterval(3600),
                duration: eventDetails.duration ?? 1800, // 30 minutes default
                participants: eventDetails.participants ?? []
            ),
            status: .pending,
            aiConfidence: 0.85
        )
    }
    
    private func createContactActionCard(from toolCall: ToolCall) -> ActionCard? {
        guard let query = toolCall.parameters["query"] else { return nil }
        
        // Contact searches typically don't create visible cards
        // Instead they provide data for other actions
        return nil
    }
    
    // MARK: - Query Parsing Methods
    
    private func parseEmailQuery(_ query: String) -> (recipient: String?, subject: String?, body: String?) {
        let lowercaseQuery = query.lowercased()
        
        // Extract recipient (email pattern or "to [name]")
        var recipient: String?
        if let emailMatch = query.range(of: #"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"#, options: .regularExpression) {
            recipient = String(query[emailMatch])
        } else if let toMatch = query.range(of: "to\\s+([\\w\\s]+?)(?:\\s+asking|\\s+about|$)", options: .regularExpression) {
            recipient = String(query[toMatch]).replacingOccurrences(of: "to ", with: "")
        }
        
        // Extract subject (usually after "asking" or "about")
        var subject: String?
        if let subjectMatch = query.range(of: "(?:asking|about)\\s+(.+?)(?:\\s+at|$)", options: .regularExpression) {
            subject = String(query[subjectMatch]).replacingOccurrences(of: "asking ", with: "").replacingOccurrences(of: "about ", with: "")
        }
        
        // Generate body based on query
        var body: String?
        if lowercaseQuery.contains("dinner") {
            body = "Hi there,\n\nI hope this message finds you well! I wanted to see if you would like to join me for dinner tonight at 6 PM. Let me know if you're available.\n\nLooking forward to hearing from you!"
        } else if lowercaseQuery.contains("meeting") {
            body = "Hi,\n\nI wanted to reach out about scheduling a meeting. Please let me know your availability.\n\nThanks!"
        } else {
            body = "Hi,\n\n" + query + "\n\nBest regards"
        }
        
        return (recipient, subject, body)
    }
    
    private func parseCalendarQuery(_ query: String) -> (title: String?, date: Date?, duration: TimeInterval?, participants: [String]?) {
        let lowercaseQuery = query.lowercased()
        
        // Extract title
        var title: String?
        if let titleMatch = query.range(of: "(?:schedule|meeting)\\s+(.+?)(?:\\s+for|\\s+at|\\s+with|$)", options: .regularExpression) {
            title = String(query[titleMatch]).replacingOccurrences(of: "schedule ", with: "").replacingOccurrences(of: "meeting ", with: "")
        } else {
            title = "Meeting"
        }
        
        // Extract date/time (simplified - in production would use more sophisticated parsing)
        var date: Date?
        if lowercaseQuery.contains("tomorrow") {
            date = Calendar.current.date(byAdding: .day, value: 1, to: Date())
        } else if lowercaseQuery.contains("next week") {
            date = Calendar.current.date(byAdding: .weekOfYear, value: 1, to: Date())
        } else {
            date = Calendar.current.date(byAdding: .hour, value: 2, to: Date()) // Default: 2 hours from now
        }
        
        // Extract duration
        var duration: TimeInterval = 1800 // 30 minutes default
        if lowercaseQuery.contains("1 hour") || lowercaseQuery.contains("one hour") {
            duration = 3600
        } else if lowercaseQuery.contains("2 hour") || lowercaseQuery.contains("two hour") {
            duration = 7200
        }
        
        // Extract participants (simplified)
        var participants: [String] = []
        if lowercaseQuery.contains("with team") {
            participants = ["team@company.com"]
        }
        
        return (title, date, duration, participants)
    }
    
    private func createMockActionCard(for command: String) -> ActionCard {
        // Create a mock card for development
        if command.lowercased().contains("email") {
            return ActionCard(
                type: .sendEmail(
                    recipient: "user@example.com",
                    subject: "From Command: \(command)",
                    body: "This email was generated from your command: \(command)"
                )
            )
        } else if command.lowercased().contains("meeting") || command.lowercased().contains("schedule") {
            return ActionCard(
                type: .scheduleEvent(
                    title: "Meeting from Command",
                    date: Date().addingTimeInterval(3600), // 1 hour from now
                    duration: 1800, // 30 minutes
                    participants: []
                )
            )
        } else {
            return ActionCard(
                type: .createNote(
                    title: "Note from Command",
                    content: command
                )
            )
        }
    }
}

// MARK: - Supporting Types

extension CommandCenterViewModel {
    enum SortOption: String, CaseIterable {
        case timestamp = "timestamp"
        case priority = "priority"
        case status = "status"
        case type = "type"
        
        var displayName: String {
            switch self {
            case .timestamp: return "Recent"
            case .priority: return "Priority"
            case .status: return "Status"
            case .type: return "Type"
            }
        }
    }
}

struct CommandCenterStats {
    let totalActions: Int
    let pendingActions: Int
    let executingActions: Int
    let completedActions: Int
    let failedActions: Int
    let successRate: Double
}

enum CommandCenterError: LocalizedError {
    case notAuthenticated
    case networkError
    case invalidResponse
    case executionFailed
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Please sign in to continue"
        case .networkError: return "Network connection failed"
        case .invalidResponse: return "Invalid response from server"
        case .executionFailed: return "Action execution failed"
        }
    }
}

// Backend response models
struct BackendResponse: Codable {
    let message: String
    let toolCalls: [ToolCall]?
    let toolResults: [ToolResult]?
    let error: String?
}

struct ToolCall: Codable {
    let name: String
    let parameters: [String: String]
}

struct ToolResult: Codable {
    let success: Bool
    let data: String?
    let error: String?
}

// MARK: - ActionCard Extensions for ViewModel

extension ActionCard {
    func updating(status: ActionStatus) -> ActionCard {
        ActionCard(
            id: self.id,
            type: self.type,
            status: status,
            aiConfidence: self.aiConfidence,
            estimatedExecutionTime: self.estimatedExecutionTime
        )
    }
}