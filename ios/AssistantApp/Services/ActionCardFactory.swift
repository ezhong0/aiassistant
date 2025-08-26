//
//  ActionCardFactory.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import Foundation

// MARK: - Action Card Factory
class ActionCardFactory {
    
    // MARK: - Main Factory Method
    static func createCards(from response: TextCommandResponse) -> [any ActionCardData] {
        guard let data = response.data else {
            return []
        }
        
        var cards: [any ActionCardData] = []
        
        // Check if the response indicates confirmation is needed
        if response.type == "confirmation_required" {
            cards.append(contentsOf: parseConfirmationResponse(data))
        }
        
        // Parse tool results that need confirmation
        if let toolResults = data.toolResults {
            for toolResult in toolResults {
                if let card = parseToolResult(toolResult) {
                    cards.append(card)
                }
            }
        }
        
        // Parse pending actions
        if let pendingActions = data.pendingActions {
            for action in pendingActions {
                if let card = parsePendingAction(action) {
                    cards.append(card)
                }
            }
        }
        
        return cards
    }
    
    // MARK: - Parse Confirmation Response
    private static func parseConfirmationResponse(_ data: TextCommandResponse.ResponseData) -> [any ActionCardData] {
        guard let pendingActions = data.pendingActions else { return [] }
        
        return pendingActions.compactMap { action in
            parsePendingAction(action)
        }
    }
    
    // MARK: - Parse Tool Results
    private static func parseToolResult(_ toolResult: ToolResult) -> (any ActionCardData)? {
        guard toolResult.requiresConfirmation else { return nil }
        
        switch toolResult.toolName {
        case "emailAgent":
            return parseEmailToolResult(toolResult)
        case "calendarAgent":
            return parseCalendarToolResult(toolResult)
        default:
            return nil
        }
    }
    
    // MARK: - Parse Pending Actions
    private static func parsePendingAction(_ action: PendingAction) -> (any ActionCardData)? {
        switch action.type {
        case "email":
            return parseEmailPendingAction(action)
        case "calendar":
            return parseCalendarPendingAction(action)
        default:
            return nil
        }
    }
    
    // MARK: - Email Parsing
    private static func parseEmailToolResult(_ toolResult: ToolResult) -> EmailActionData? {
        guard let resultData = toolResult.result as? [String: Any] else { return nil }
        
        // Extract email details from tool result
        let actionType = resultData["action_type"] as? String ?? "send_email"
        let subject = resultData["subject"] as? String ?? ""
        let body = resultData["body"] as? String ?? ""
        let recipientsData = resultData["recipients"] as? [[String: Any]] ?? []
        
        let recipients = recipientsData.compactMap { recipientData in
            guard let email = recipientData["email"] as? String else { return nil }
            let displayName = recipientData["displayName"] as? String ?? email
            let isVerified = recipientData["isVerified"] as? Bool ?? true
            return EmailRecipient(email: email, displayName: displayName, isVerified: isVerified)
        }
        
        switch actionType {
        case "send_email":
            return EmailActionData.sendEmail(
                to: recipients,
                subject: subject,
                body: body
            )
        case "reply_email":
            let threadId = resultData["threadId"] as? String ?? ""
            return EmailActionData.replyToEmail(
                threadId: threadId,
                to: recipients,
                subject: subject,
                body: body
            )
        case "forward_email":
            let originalThreadId = resultData["originalThreadId"] as? String ?? ""
            return EmailActionData.forwardEmail(
                originalThreadId: originalThreadId,
                to: recipients,
                subject: subject,
                body: body
            )
        default:
            return nil
        }
    }
    
    private static func parseEmailPendingAction(_ action: PendingAction) -> EmailActionData? {
        guard let parameters = action.parameters else { return nil }
        
        let query = parameters["query"] as? String ?? ""
        let actionType = parameters["action_type"] as? String ?? "send_email"
        
        // Parse recipients from query or parameters
        let recipients = parseRecipientsFromParameters(parameters)
        
        // Parse subject and body from query using simple heuristics
        let (subject, body) = parseSubjectAndBodyFromQuery(query)
        
        switch actionType {
        case "send_email":
            return EmailActionData.sendEmail(
                to: recipients,
                subject: subject,
                body: body
            )
        case "reply_email":
            return EmailActionData.replyToEmail(
                threadId: parameters["threadId"] as? String ?? "",
                to: recipients,
                subject: subject,
                body: body
            )
        default:
            return EmailActionData.sendEmail(
                to: recipients,
                subject: subject,
                body: body
            )
        }
    }
    
    // MARK: - Calendar Parsing
    private static func parseCalendarToolResult(_ toolResult: ToolResult) -> CalendarActionData? {
        guard let resultData = toolResult.result as? [String: Any] else { return nil }
        
        let actionType = resultData["action_type"] as? String ?? "create_meeting"
        let title = resultData["title"] as? String ?? "Meeting"
        let startDateString = resultData["startDate"] as? String
        let duration = resultData["duration"] as? TimeInterval ?? 3600 // Default 1 hour
        
        guard let startDate = parseDateFromString(startDateString) else { return nil }
        
        let attendeesData = resultData["attendees"] as? [[String: Any]] ?? []
        let attendees = attendeesData.compactMap { attendeeData in
            guard let email = attendeeData["email"] as? String else { return nil }
            let displayName = attendeeData["displayName"] as? String ?? email
            return EmailRecipient(email: email, displayName: displayName)
        }
        
        let location = resultData["location"] as? String
        let description = resultData["description"] as? String
        
        switch actionType {
        case "create_meeting":
            return CalendarActionData.createMeeting(
                title: title,
                startDate: startDate,
                duration: duration,
                attendees: attendees,
                location: location,
                description: description
            )
        case "reschedule_meeting":
            return CalendarActionData.rescheduleMeeting(
                originalEventId: resultData["originalEventId"] as? String ?? "",
                title: title,
                newStartDate: startDate,
                duration: duration,
                attendees: attendees
            )
        case "cancel_meeting":
            return CalendarActionData.cancelMeeting(
                eventId: resultData["eventId"] as? String ?? "",
                title: title,
                startDate: startDate,
                attendees: attendees,
                reason: description
            )
        default:
            return nil
        }
    }
    
    private static func parseCalendarPendingAction(_ action: PendingAction) -> CalendarActionData? {
        guard let parameters = action.parameters else { return nil }
        
        let query = parameters["query"] as? String ?? ""
        let actionType = parameters["action_type"] as? String ?? "create_meeting"
        
        // Parse meeting details from query using simple heuristics
        let (title, startDate, duration) = parseMeetingDetailsFromQuery(query)
        let attendees = parseRecipientsFromParameters(parameters)
        
        switch actionType {
        case "create_meeting":
            return CalendarActionData.createMeeting(
                title: title,
                startDate: startDate,
                duration: duration,
                attendees: attendees
            )
        default:
            return CalendarActionData.createMeeting(
                title: title,
                startDate: startDate,
                duration: duration,
                attendees: attendees
            )
        }
    }
    
    // MARK: - Helper Parsing Methods
    private static func parseRecipientsFromParameters(_ parameters: [String: Any]) -> [EmailRecipient] {
        // Try to get recipients from various parameter formats
        if let recipientsData = parameters["recipients"] as? [[String: Any]] {
            return recipientsData.compactMap { recipientData in
                guard let email = recipientData["email"] as? String else { return nil }
                let displayName = recipientData["displayName"] as? String ?? email
                return EmailRecipient(email: email, displayName: displayName)
            }
        }
        
        if let emails = parameters["to"] as? [String] {
            return emails.map { EmailRecipient(email: $0) }
        }
        
        if let email = parameters["to"] as? String {
            return [EmailRecipient(email: email)]
        }
        
        // Try to extract from query
        if let query = parameters["query"] as? String {
            return extractRecipientsFromQuery(query)
        }
        
        return []
    }
    
    private static func parseSubjectAndBodyFromQuery(_ query: String) -> (subject: String, body: String) {
        let lowercaseQuery = query.lowercased()
        
        // Simple heuristics for extracting subject and body
        var subject = ""
        var body = query
        
        if lowercaseQuery.contains("subject") {
            if let range = query.range(of: "subject:", options: .caseInsensitive) {
                let afterSubject = String(query[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let lineEnd = afterSubject.firstIndex(of: "\n") ?? afterSubject.firstIndex(of: ".") {
                    subject = String(afterSubject[..<lineEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                    subject = afterSubject
                }
            }
        }
        
        if subject.isEmpty {
            // Try to infer subject from the query
            if lowercaseQuery.contains("about") {
                if let range = query.range(of: "about", options: .caseInsensitive) {
                    subject = String(query[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        
        return (subject: subject, body: body)
    }
    
    private static func parseMeetingDetailsFromQuery(_ query: String) -> (title: String, startDate: Date, duration: TimeInterval) {
        let title = extractMeetingTitleFromQuery(query)
        let startDate = extractDateFromQuery(query) ?? Date().addingTimeInterval(3600) // Default to 1 hour from now
        let duration = extractDurationFromQuery(query)
        
        return (title, startDate, duration)
    }
    
    private static func extractRecipientsFromQuery(_ query: String) -> [EmailRecipient] {
        let emailPattern = #"[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"#
        let regex = try! NSRegularExpression(pattern: emailPattern)
        let matches = regex.matches(in: query, range: NSRange(query.startIndex..., in: query))
        
        return matches.compactMap { match in
            guard let range = Range(match.range, in: query) else { return nil }
            let email = String(query[range])
            return EmailRecipient(email: email)
        }
    }
    
    private static func extractMeetingTitleFromQuery(_ query: String) -> String {
        // Simple heuristics to extract meeting title
        let patterns = ["meeting about", "schedule", "book"]
        
        for pattern in patterns {
            if let range = query.range(of: pattern, options: .caseInsensitive) {
                let afterPattern = String(query[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !afterPattern.isEmpty {
                    return afterPattern.components(separatedBy: " with ").first ?? afterPattern
                }
            }
        }
        
        return "Meeting"
    }
    
    private static func extractDateFromQuery(_ query: String) -> Date? {
        let now = Date()
        let calendar = Calendar.current
        let lowercaseQuery = query.lowercased()
        
        // Simple date parsing
        if lowercaseQuery.contains("tomorrow") {
            return calendar.date(byAdding: .day, value: 1, to: now)
        } else if lowercaseQuery.contains("next week") {
            return calendar.date(byAdding: .weekOfYear, value: 1, to: now)
        } else if lowercaseQuery.contains("monday") {
            return nextWeekday(.monday, from: now)
        } else if lowercaseQuery.contains("tuesday") {
            return nextWeekday(.tuesday, from: now)
        } else if lowercaseQuery.contains("wednesday") {
            return nextWeekday(.wednesday, from: now)
        } else if lowercaseQuery.contains("thursday") {
            return nextWeekday(.thursday, from: now)
        } else if lowercaseQuery.contains("friday") {
            return nextWeekday(.friday, from: now)
        }
        
        return nil
    }
    
    private static func extractDurationFromQuery(_ query: String) -> TimeInterval {
        let lowercaseQuery = query.lowercased()
        
        if lowercaseQuery.contains("30 minutes") || lowercaseQuery.contains("30min") {
            return 1800 // 30 minutes
        } else if lowercaseQuery.contains("15 minutes") || lowercaseQuery.contains("15min") {
            return 900 // 15 minutes
        } else if lowercaseQuery.contains("2 hours") {
            return 7200 // 2 hours
        } else if lowercaseQuery.contains("hour") {
            return 3600 // 1 hour default
        }
        
        return 3600 // Default 1 hour
    }
    
    private static func parseDateFromString(_ dateString: String?) -> Date? {
        guard let dateString = dateString else { return nil }
        
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            return date
        }
        
        // Try other common formats
        let formatters = [
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
            "MM/dd/yyyy HH:mm",
            "yyyy-MM-dd"
        ]
        
        for format in formatters {
            let formatter = DateFormatter()
            formatter.dateFormat = format
            if let date = formatter.date(from: dateString) {
                return date
            }
        }
        
        return nil
    }
    
    private static func nextWeekday(_ weekday: Calendar.Component, from date: Date) -> Date? {
        let calendar = Calendar.current
        let weekdayValue: Int
        
        switch weekday {
        case .sunday: weekdayValue = 1
        case .monday: weekdayValue = 2
        case .tuesday: weekdayValue = 3
        case .wednesday: weekdayValue = 4
        case .thursday: weekdayValue = 5
        case .friday: weekdayValue = 6
        case .saturday: weekdayValue = 7
        default: return nil
        }
        
        let currentWeekday = calendar.component(.weekday, from: date)
        let daysToAdd = (weekdayValue - currentWeekday + 7) % 7
        let targetDate = calendar.date(byAdding: .day, value: daysToAdd == 0 ? 7 : daysToAdd, to: date)
        
        return targetDate
    }
}

// MARK: - Supporting Types for Backend Response Parsing
struct ToolResult: Codable {
    let toolName: String
    let success: Bool
    let result: [String: Any]?
    let error: String?
    let requiresConfirmation: Bool
    let executionTime: TimeInterval?
    
    enum CodingKeys: String, CodingKey {
        case toolName, success, error, requiresConfirmation, executionTime
        case result
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        toolName = try container.decode(String.self, forKey: .toolName)
        success = try container.decode(Bool.self, forKey: .success)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        requiresConfirmation = try container.decodeIfPresent(Bool.self, forKey: .requiresConfirmation) ?? false
        executionTime = try container.decodeIfPresent(TimeInterval.self, forKey: .executionTime)
        
        // Handle the result as a generic dictionary
        if let resultData = try? container.decodeIfPresent(Data.self, forKey: .result) {
            result = try? JSONSerialization.jsonObject(with: resultData) as? [String: Any]
        } else {
            result = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(toolName, forKey: .toolName)
        try container.encode(success, forKey: .success)
        try container.encodeIfPresent(error, forKey: .error)
        try container.encode(requiresConfirmation, forKey: .requiresConfirmation)
        try container.encodeIfPresent(executionTime, forKey: .executionTime)
        
        if let result = result {
            let resultData = try JSONSerialization.data(withJSONObject: result)
            try container.encode(resultData, forKey: .result)
        }
    }
}

struct PendingAction: Codable {
    let actionId: String
    let type: String
    let parameters: [String: Any]?
    let awaitingConfirmation: Bool
    
    enum CodingKeys: String, CodingKey {
        case actionId, type, awaitingConfirmation
        case parameters
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        actionId = try container.decode(String.self, forKey: .actionId)
        type = try container.decode(String.self, forKey: .type)
        awaitingConfirmation = try container.decode(Bool.self, forKey: .awaitingConfirmation)
        
        if let parametersData = try? container.decodeIfPresent(Data.self, forKey: .parameters) {
            parameters = try? JSONSerialization.jsonObject(with: parametersData) as? [String: Any]
        } else {
            parameters = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(actionId, forKey: .actionId)
        try container.encode(type, forKey: .type)
        try container.encode(awaitingConfirmation, forKey: .awaitingConfirmation)
        
        if let parameters = parameters {
            let parametersData = try JSONSerialization.data(withJSONObject: parameters)
            try container.encode(parametersData, forKey: .parameters)
        }
    }
}