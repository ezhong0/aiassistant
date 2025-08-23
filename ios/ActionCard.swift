//
//  ActionCard.swift
//  AssistantApp
//
//  Action card data models for Command Center UI
//

import Foundation
import SwiftUI

// MARK: - Core Action Card Models

/// Represents an AI-proposed action that can be presented to the user
struct ActionCard: Identifiable, Codable {
    let id: UUID
    let type: ActionType
    let status: ActionStatus
    let timestamp: Date
    let aiConfidence: Double
    let estimatedExecutionTime: TimeInterval?
    
    /// User-visible properties
    var title: String { type.title }
    var subtitle: String { type.subtitle }
    var icon: String { type.icon }
    var color: Color { type.color }
    var priority: ActionPriority { type.priority }
    var requiresConfirmation: Bool { type.requiresConfirmation }
    
    init(id: UUID = UUID(), type: ActionType, status: ActionStatus = .pending, aiConfidence: Double = 0.95, estimatedExecutionTime: TimeInterval? = nil) {
        self.id = id
        self.type = type
        self.status = status
        self.timestamp = Date()
        self.aiConfidence = aiConfidence
        self.estimatedExecutionTime = estimatedExecutionTime
    }
}

// MARK: - Action Types

/// Different types of actions the AI can propose
enum ActionType: Codable {
    case sendEmail(recipient: String, subject: String, body: String)
    case scheduleEvent(title: String, date: Date, duration: TimeInterval, participants: [String])
    case searchContacts(query: String, results: [ContactResult])
    case createNote(title: String, content: String)
    case searchWeb(query: String, summary: String)
    case makeCall(contact: String, phoneNumber: String)
    case sendMessage(recipient: String, message: String)
    
    // UI Properties
    var title: String {
        switch self {
        case .sendEmail(let recipient, let subject, _):
            return "Send Email to \(recipient)"
        case .scheduleEvent(let title, _, _, _):
            return "Schedule: \(title)"
        case .searchContacts(let query, _):
            return "Find Contact: \(query)"
        case .createNote(let title, _):
            return "Create Note: \(title)"
        case .searchWeb(let query, _):
            return "Web Search: \(query)"
        case .makeCall(let contact, _):
            return "Call \(contact)"
        case .sendMessage(let recipient, _):
            return "Message \(recipient)"
        }
    }
    
    var subtitle: String {
        switch self {
        case .sendEmail(_, let subject, _):
            return "Subject: \(subject)"
        case .scheduleEvent(_, let date, let duration, let participants):
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return "\(formatter.string(from: date)) • \(Int(duration/60))min • \(participants.count) people"
        case .searchContacts(_, let results):
            return "\(results.count) results found"
        case .createNote(_, let content):
            return String(content.prefix(50)) + (content.count > 50 ? "..." : "")
        case .searchWeb(_, let summary):
            return String(summary.prefix(80)) + (summary.count > 80 ? "..." : "")
        case .makeCall(_, let phoneNumber):
            return phoneNumber
        case .sendMessage(_, let message):
            return String(message.prefix(50)) + (message.count > 50 ? "..." : "")
        }
    }
    
    var icon: String {
        switch self {
        case .sendEmail: return "envelope.fill"
        case .scheduleEvent: return "calendar.badge.plus"
        case .searchContacts: return "person.2.fill"
        case .createNote: return "doc.text.fill"
        case .searchWeb: return "magnifyingglass"
        case .makeCall: return "phone.fill"
        case .sendMessage: return "message.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .sendEmail: return .blue
        case .scheduleEvent: return .green
        case .searchContacts: return .purple
        case .createNote: return .orange
        case .searchWeb: return .indigo
        case .makeCall: return .red
        case .sendMessage: return .cyan
        }
    }
    
    var priority: ActionPriority {
        switch self {
        case .sendEmail, .scheduleEvent, .makeCall: return .high
        case .sendMessage, .createNote: return .medium
        case .searchContacts, .searchWeb: return .low
        }
    }
    
    var requiresConfirmation: Bool {
        switch self {
        case .sendEmail, .scheduleEvent, .makeCall, .sendMessage: return true
        case .searchContacts, .createNote, .searchWeb: return false
        }
    }
}

// MARK: - Action Status

/// Tracks the lifecycle state of an action card
enum ActionStatus: String, Codable, CaseIterable {
    case pending = "pending"
    case userReviewing = "user_reviewing"
    case approved = "approved"
    case executing = "executing"
    case completed = "completed"
    case failed = "failed"
    case dismissed = "dismissed"
    case edited = "edited"
    
    var displayName: String {
        switch self {
        case .pending: return "Waiting"
        case .userReviewing: return "Review"
        case .approved: return "Approved"
        case .executing: return "Processing"
        case .completed: return "Done"
        case .failed: return "Failed"
        case .dismissed: return "Dismissed"
        case .edited: return "Modified"
        }
    }
    
    var color: Color {
        switch self {
        case .pending, .userReviewing: return .blue
        case .approved: return .green
        case .executing: return .orange
        case .completed: return .green
        case .failed: return .red
        case .dismissed: return .gray
        case .edited: return .purple
        }
    }
    
    var isActive: Bool {
        switch self {
        case .pending, .userReviewing, .approved, .executing: return true
        case .completed, .failed, .dismissed: return false
        case .edited: return true
        }
    }
}

// MARK: - Action Priority

enum ActionPriority: String, Codable, Comparable {
    case low = "low"
    case medium = "medium" 
    case high = "high"
    case urgent = "urgent"
    
    static func < (lhs: ActionPriority, rhs: ActionPriority) -> Bool {
        let order: [ActionPriority] = [.low, .medium, .high, .urgent]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
}

// MARK: - Supporting Models

struct ContactResult: Codable {
    let id: String
    let name: String
    let email: String?
    let phoneNumber: String?
    let imageUrl: String?
}

// MARK: - Action Card Extensions

extension ActionCard {
    /// Returns the detailed content for display in expanded view
    var detailContent: String {
        switch type {
        case .sendEmail(_, _, let body):
            return body
        case .scheduleEvent(_, _, _, _):
            return "Event details and agenda"
        case .searchContacts(_, let results):
            return results.map { "\($0.name): \($0.email ?? "No email")" }.joined(separator: "\n")
        case .createNote(_, let content):
            return content
        case .searchWeb(_, let summary):
            return summary
        case .makeCall(_, _):
            return "Tap to call"
        case .sendMessage(_, let message):
            return message
        }
    }
    
    /// Returns true if this action can be edited by the user
    var isEditable: Bool {
        switch status {
        case .pending, .userReviewing, .edited: return true
        case .approved, .executing, .completed, .failed, .dismissed: return false
        }
    }
    
    /// Returns true if this action can be approved by the user
    var canBeApproved: Bool {
        return status == .pending || status == .userReviewing || status == .edited
    }
    
    /// Returns progress percentage for executing actions
    var executionProgress: Double {
        switch status {
        case .pending, .userReviewing: return 0.0
        case .approved: return 0.1
        case .executing: return 0.5
        case .completed: return 1.0
        case .failed, .dismissed: return 0.0
        case .edited: return 0.0
        }
    }
}

// MARK: - Mock Data for Development

extension ActionCard {
    static let mockCards: [ActionCard] = [
        ActionCard(
            type: .sendEmail(
                recipient: "john@example.com",
                subject: "Dinner Tonight?",
                body: "Hi there,\n\nI hope this message finds you well! I wanted to see if you would like to join me for dinner tonight at 6 PM. Let me know if you're available.\n\nLooking forward to hearing from you!"
            ),
            status: .pending,
            aiConfidence: 0.95
        ),
        ActionCard(
            type: .scheduleEvent(
                title: "Team Standup",
                date: Calendar.current.date(byAdding: .hour, value: 2, to: Date())!,
                duration: 1800, // 30 minutes
                participants: ["alice@company.com", "bob@company.com"]
            ),
            status: .executing,
            aiConfidence: 0.88
        ),
        ActionCard(
            type: .createNote(
                title: "Meeting Notes",
                content: "Key points from today's discussion:\n- Q4 goals finalized\n- New feature requirements\n- Team assignments"
            ),
            status: .completed,
            aiConfidence: 0.92
        )
    ]
}