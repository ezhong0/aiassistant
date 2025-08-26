//
//  CalendarActionData.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import Foundation

// MARK: - Calendar Action Cards
struct CalendarActionData: ActionCardData {
    let id = UUID()
    let agentType: AgentType = .calendar
    let actionType: String
    let title: String
    let subtitle: String?
    let isDestructive: Bool
    let requiresConfirmation: Bool = true
    let estimatedExecutionTime: TimeInterval? = 1.5
    
    // Calendar-specific properties
    let eventTitle: String
    let startDate: Date
    let endDate: Date
    let attendees: [EmailRecipient]
    let location: String?
    let description: String?
    let conflicts: [CalendarConflict]
    let meetingRoom: MeetingRoom?
    let isRecurring: Bool
    let recurrenceRule: RecurrenceRule?
    
    struct RecurrenceRule: Codable {
        let frequency: Frequency
        let interval: Int
        let endDate: Date?
        let occurrenceCount: Int?
        
        enum Frequency: String, CaseIterable, Codable {
            case daily = "daily"
            case weekly = "weekly"
            case monthly = "monthly"
            case yearly = "yearly"
            
            var displayText: String {
                switch self {
                case .daily: return "Daily"
                case .weekly: return "Weekly"
                case .monthly: return "Monthly"
                case .yearly: return "Yearly"
                }
            }
        }
    }
    
    // MARK: - Computed Properties
    var duration: TimeInterval {
        endDate.timeIntervalSince(startDate)
    }
    
    var durationText: String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        
        if hours > 0 {
            return minutes > 0 ? "\(hours)h \(minutes)m" : "\(hours)h"
        } else {
            return "\(minutes)m"
        }
    }
    
    var hasConflicts: Bool {
        !conflicts.isEmpty
    }
    
    var criticalConflicts: [CalendarConflict] {
        conflicts.filter { $0.severity == .error }
    }
    
    // MARK: - Factory Methods
    static func createMeeting(
        title: String,
        startDate: Date,
        duration: TimeInterval,
        attendees: [EmailRecipient],
        location: String? = nil,
        description: String? = nil,
        conflicts: [CalendarConflict] = []
    ) -> CalendarActionData {
        let endDate = startDate.addingTimeInterval(duration)
        let attendeeNames = attendees.map(\.displayName).joined(separator: ", ")
        let subtitle = DateFormatter.shortDateTime.string(from: startDate)
        
        return CalendarActionData(
            actionType: "create_meeting",
            title: "Schedule Meeting",
            subtitle: subtitle,
            isDestructive: false,
            eventTitle: title,
            startDate: startDate,
            endDate: endDate,
            attendees: attendees,
            location: location,
            description: description,
            conflicts: conflicts,
            meetingRoom: nil,
            isRecurring: false,
            recurrenceRule: nil
        )
    }
    
    static func createRecurringMeeting(
        title: String,
        startDate: Date,
        duration: TimeInterval,
        attendees: [EmailRecipient],
        recurrenceRule: RecurrenceRule,
        location: String? = nil,
        description: String? = nil
    ) -> CalendarActionData {
        let endDate = startDate.addingTimeInterval(duration)
        let subtitle = "\(DateFormatter.shortDateTime.string(from: startDate)) (\(recurrenceRule.frequency.displayText))"
        
        return CalendarActionData(
            actionType: "create_recurring_meeting",
            title: "Schedule Recurring Meeting",
            subtitle: subtitle,
            isDestructive: false,
            eventTitle: title,
            startDate: startDate,
            endDate: endDate,
            attendees: attendees,
            location: location,
            description: description,
            conflicts: [],
            meetingRoom: nil,
            isRecurring: true,
            recurrenceRule: recurrenceRule
        )
    }
    
    static func rescheduleMeeting(
        originalEventId: String,
        title: String,
        newStartDate: Date,
        duration: TimeInterval,
        attendees: [EmailRecipient],
        conflicts: [CalendarConflict] = []
    ) -> CalendarActionData {
        let endDate = newStartDate.addingTimeInterval(duration)
        let subtitle = "Move to \(DateFormatter.shortDateTime.string(from: newStartDate))"
        
        return CalendarActionData(
            actionType: "reschedule_meeting",
            title: "Reschedule Meeting",
            subtitle: subtitle,
            isDestructive: false,
            eventTitle: title,
            startDate: newStartDate,
            endDate: endDate,
            attendees: attendees,
            location: nil,
            description: nil,
            conflicts: conflicts,
            meetingRoom: nil,
            isRecurring: false,
            recurrenceRule: nil
        )
    }
    
    static func cancelMeeting(
        eventId: String,
        title: String,
        startDate: Date,
        attendees: [EmailRecipient],
        reason: String? = nil
    ) -> CalendarActionData {
        let subtitle = "Cancel \(DateFormatter.shortDateTime.string(from: startDate))"
        
        return CalendarActionData(
            actionType: "cancel_meeting",
            title: "Cancel Meeting",
            subtitle: subtitle,
            isDestructive: true,
            eventTitle: title,
            startDate: startDate,
            endDate: startDate,
            attendees: attendees,
            location: nil,
            description: reason,
            conflicts: [],
            meetingRoom: nil,
            isRecurring: false,
            recurrenceRule: nil
        )
    }
}

// MARK: - Calendar Action Result
struct CalendarActionResult: Codable {
    let eventId: String?
    let status: String
    let timestamp: Date
    let attendeeStatus: [AttendeeStatus]?
    
    struct AttendeeStatus: Codable {
        let email: String
        let responseStatus: ResponseStatus
        
        enum ResponseStatus: String, Codable {
            case needsAction = "needsAction"
            case accepted = "accepted"
            case declined = "declined"
            case tentative = "tentative"
        }
    }
}

// MARK: - Date Formatter Extension
extension DateFormatter {
    static let shortDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()
    
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter
    }()
    
    static let shortTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()
}