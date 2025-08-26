//
//  ActionCardsManager.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import Foundation
import SwiftUI
import Combine

// MARK: - Card Container Management
@MainActor
class ActionCardsManager: ObservableObject {
    @Published var cards: [AnyActionCard] = []
    @Published var isPresented: Bool = false
    @Published var isProcessing: Bool = false
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Card Management
    func presentCards(_ newCards: [any ActionCardData]) {
        let anyCards = newCards.map { AnyActionCard($0) }
        
        withAnimation(.spring()) {
            cards = anyCards
            isPresented = !anyCards.isEmpty
        }
    }
    
    func dismissCards() {
        withAnimation(.spring()) {
            isPresented = false
            isProcessing = false
            // Delay clearing cards to allow animation to complete
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.cards.removeAll()
            }
        }
    }
    
    func removeCard(withId id: UUID) {
        withAnimation(.spring()) {
            cards.removeAll { $0.id == id }
            if cards.isEmpty {
                isPresented = false
            }
        }
    }
    
    func updateCardState(id: UUID, state: ActionCardState) {
        if let index = cards.firstIndex(where: { $0.id == id }) {
            cards[index].updateState(state)
        }
    }
    
    // MARK: - Bulk Operations
    func confirmAllCards() async {
        isProcessing = true
        
        for card in cards {
            if case .pending = card.state {
                await card.confirm()
            }
        }
        
        isProcessing = false
        
        // Auto-dismiss if all cards are completed
        let allCompleted = cards.allSatisfy { card in
            switch card.state {
            case .completed, .cancelled: return true
            default: return false
            }
        }
        
        if allCompleted {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.dismissCards()
            }
        }
    }
    
    func cancelAllCards() {
        for card in cards {
            card.cancel()
        }
        dismissCards()
    }
    
    // MARK: - State Queries
    var hasActiveCards: Bool {
        !cards.isEmpty && cards.contains { card in
            switch card.state {
            case .pending, .executing, .confirming: return true
            default: return false
            }
        }
    }
    
    var completedCardsCount: Int {
        cards.filter { card in
            if case .completed = card.state { return true }
            return false
        }.count
    }
    
    var failedCardsCount: Int {
        cards.filter { card in
            if case .failed = card.state { return true }
            return false
        }.count
    }
}

// MARK: - Type-Erased Action Card
class AnyActionCard: ObservableObject, Identifiable {
    let id: UUID
    let agentType: AgentType
    let actionType: String
    let title: String
    let subtitle: String?
    let isDestructive: Bool
    let requiresConfirmation: Bool
    
    @Published var state: ActionCardState = .pending
    @Published var progress: Double = 0.0
    @Published var errorMessage: String?
    
    private let _confirm: () async -> Void
    private let _cancel: () -> Void
    private let _edit: (() async -> Void)?
    private let _retry: (() async -> Void)?
    
    // Public properties to check availability
    var hasEditAction: Bool { _edit != nil }
    var hasRetryAction: Bool { _retry != nil }
    
    init<T: ActionCardData>(_ cardData: T) {
        self.id = cardData.id
        self.agentType = cardData.agentType
        self.actionType = cardData.actionType
        self.title = cardData.title
        self.subtitle = cardData.subtitle
        self.isDestructive = cardData.isDestructive
        self.requiresConfirmation = cardData.requiresConfirmation
        
        // Create closures that will be implemented by specific ViewModels
        self._confirm = {
            // This will be overridden by specific implementations
            print("Confirm action for \(cardData.actionType)")
        }
        
        self._cancel = {
            print("Cancel action for \(cardData.actionType)")
        }
        
        self._edit = {
            print("Edit action for \(cardData.actionType)")
        }
        
        self._retry = {
            print("Retry action for \(cardData.actionType)")
        }
    }
    
    // MARK: - Actions
    func confirm() async {
        await _confirm()
    }
    
    func cancel() {
        _cancel()
        state = .cancelled
    }
    
    func edit() async {
        if let editAction = _edit {
            await editAction()
        }
    }
    
    func retry() async {
        if let retryAction = _retry {
            errorMessage = nil
            await retryAction()
        }
    }
    
    func updateState(_ newState: ActionCardState) {
        state = newState
        
        // Extract progress if it's an executing state
        if case .executing(let progressValue) = newState {
            progress = progressValue
        }
    }
    
    func setError(_ message: String) {
        errorMessage = message
        state = .failed(message)
    }
}

// MARK: - Card Container View
struct ActionCardsContainerView: View {
    @ObservedObject var manager: ActionCardsManager
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        VStack(spacing: 0) {
            if manager.isPresented && !manager.cards.isEmpty {
                // Header
                ActionCardsHeader(manager: manager)
                
                // Cards
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(manager.cards) { card in
                            ActionCardRowView(card: card, manager: manager)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .frame(maxHeight: 400) // Limit height to prevent taking over screen
                
                // Footer with bulk actions
                if manager.cards.count > 1 {
                    ActionCardsFooter(manager: manager)
                }
            }
        }
        .background(backgroundColor)
        .cornerRadius(16, corners: [.topLeft, .topRight])
        .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: -5)
    }
    
    private var backgroundColor: Color {
        Color(uiColor: colorScheme == .dark ? .systemGroupedBackground : .systemBackground)
    }
}

// MARK: - Action Cards Header
struct ActionCardsHeader: View {
    @ObservedObject var manager: ActionCardsManager
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Confirm Actions")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("\(manager.cards.count) action\(manager.cards.count == 1 ? "" : "s") require confirmation")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button("Dismiss") {
                manager.dismissCards()
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color.secondary.opacity(0.1))
    }
}

// MARK: - Action Cards Footer
struct ActionCardsFooter: View {
    @ObservedObject var manager: ActionCardsManager
    
    var body: some View {
        HStack(spacing: 16) {
            Button("Cancel All") {
                manager.cancelAllCards()
            }
            .buttonStyle(SecondaryButtonStyle())
            
            Button("Confirm All") {
                Task {
                    await manager.confirmAllCards()
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(manager.isProcessing)
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
    }
}

// MARK: - Individual Card Row View
struct ActionCardRowView: View {
    @ObservedObject var card: AnyActionCard
    @ObservedObject var manager: ActionCardsManager
    
    var body: some View {
        ActionCard(cardData: CardDataWrapper(card)) {
            VStack(alignment: .leading, spacing: 12) {
                // Error message if any
                if let errorMessage = card.errorMessage {
                    ErrorMessageView(message: errorMessage)
                }
                
                // Action buttons
                ActionButtonsView(
                    state: card.state,
                    isDestructive: card.isDestructive,
                    onConfirm: { await card.confirm() },
                    onCancel: { 
                        card.cancel()
                        manager.removeCard(withId: card.id)
                    },
                    onEdit: card.hasEditAction ? { await card.edit() } : nil,
                    onRetry: card.hasRetryAction ? { await card.retry() } : nil
                )
            }
        }
    }
}

// MARK: - Wrapper to make AnyActionCard conform to ActionCardData
private struct CardDataWrapper: ActionCardData {
    let card: AnyActionCard
    
    init(_ card: AnyActionCard) {
        self.card = card
    }
    
    var id: UUID { card.id }
    var agentType: AgentType { card.agentType }
    var actionType: String { card.actionType }
    var title: String { card.title }
    var subtitle: String? { card.subtitle }
    var isDestructive: Bool { card.isDestructive }
    var requiresConfirmation: Bool { card.requiresConfirmation }
    var estimatedExecutionTime: TimeInterval? { nil }
}

// MARK: - View Extension for Custom Corner Radius
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}