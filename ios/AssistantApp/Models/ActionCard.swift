//
//  ActionCard.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import Foundation
import SwiftUI

// MARK: - Core Protocol Design
protocol ActionCardData {
    var id: UUID { get }
    var agentType: AgentType { get }
    var actionType: String { get }
    var title: String { get }
    var subtitle: String? { get }
    var isDestructive: Bool { get }
    var requiresConfirmation: Bool { get }
    var estimatedExecutionTime: TimeInterval? { get }
}

protocol ActionCardViewModeling: ObservableObject {
    var state: ActionCardState { get set }
    var progress: Double { get set }
    var errorMessage: String? { get set }
    
    func confirm() async
    func cancel()
    func edit() async
    func retry() async
}

// MARK: - State Management
enum ActionCardState: Equatable {
    case pending
    case confirming
    case executing(progress: Double)
    case completed
    case cancelled
    case failed(String)
    
    var isInteractive: Bool {
        switch self {
        case .pending, .failed: return true
        default: return false
        }
    }
    
    var displayText: String {
        switch self {
        case .pending: return "Ready"
        case .confirming: return "Confirming..."
        case .executing(let progress): return "Executing \(Int(progress * 100))%"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        case .failed: return "Failed"
        }
    }
}

// MARK: - Agent Types
enum AgentType: String, CaseIterable {
    case email = "emailAgent"
    case calendar = "calendarAgent"
    case contact = "contactAgent"
    case think = "Think"
    case contentCreator = "contentCreator"
    
    var icon: String {
        switch self {
        case .email: return "envelope.fill"
        case .calendar: return "calendar.badge.plus"
        case .contact: return "person.crop.circle"
        case .think: return "brain.head.profile"
        case .contentCreator: return "doc.text.fill"
        }
    }
    
    var primaryColor: Color {
        switch self {
        case .email: return .blue
        case .calendar: return .green
        case .contact: return .orange
        case .think: return .purple
        case .contentCreator: return .pink
        }
    }
}

// MARK: - Supporting Data Types
struct EmailRecipient: Identifiable, Codable {
    let id = UUID()
    let email: String
    let displayName: String
    let isVerified: Bool
    
    init(email: String, displayName: String? = nil, isVerified: Bool = true) {
        self.email = email
        self.displayName = displayName ?? email
        self.isVerified = isVerified
    }
}

struct AttachmentInfo: Identifiable, Codable {
    let id = UUID()
    let name: String
    let size: Int64
    let mimeType: String
    let isUploaded: Bool
}

struct CalendarConflict: Identifiable, Codable {
    let id = UUID()
    let conflictingEventTitle: String
    let conflictTime: Date
    let severity: ConflictSeverity
    
    enum ConflictSeverity: String, Codable {
        case warning = "warning"
        case error = "error"
    }
}

struct MeetingRoom: Identifiable, Codable {
    let id = UUID()
    let name: String
    let capacity: Int
    let isAvailable: Bool
}