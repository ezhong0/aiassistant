//
//  CalendarActionCardView.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import SwiftUI

// MARK: - Calendar Action Card View Model
@MainActor
class CalendarActionCardViewModel: ObservableObject, ActionCardViewModeling {
    let cardData: CalendarActionData
    @Published var state: ActionCardState = .pending
    @Published var progress: Double = 0.0
    @Published var errorMessage: String?
    
    private let apiService: APIServiceProtocol
    private let hapticFeedback = UIImpactFeedbackGenerator(style: .medium)
    
    init(cardData: CalendarActionData, apiService: APIServiceProtocol = APIService.shared) {
        self.cardData = cardData
        self.apiService = apiService
    }
    
    func confirm() async {
        hapticFeedback.impactOccurred()
        state = .confirming
        
        do {
            state = .executing(progress: 0.1)
            
            // Step 1: Validate meeting details
            try await validateMeetingDetails()
            state = .executing(progress: 0.3)
            
            // Step 2: Check for conflicts
            try await checkForConflicts()
            state = .executing(progress: 0.5)
            
            // Step 3: Execute calendar action
            let result = try await executeCalendarAction()
            state = .executing(progress: 0.9)
            
            // Step 4: Handle success
            await handleSuccessfulExecution(result)
            state = .completed
            
        } catch {
            await handleExecutionError(error)
        }
    }
    
    func cancel() {
        hapticFeedback.impactOccurred()
        state = .cancelled
        
        // Analytics tracking
        AnalyticsService.shared.track(.actionCancelled, properties: [
            "agent_type": cardData.agentType.rawValue,
            "action_type": cardData.actionType
        ])
    }
    
    func edit() async {
        print("Edit requested for calendar action: \(cardData.actionType)")
    }
    
    func retry() async {
        guard case .failed = state else { return }
        errorMessage = nil
        await confirm()
    }
    
    // MARK: - Private Implementation
    private func validateMeetingDetails() async throws {
        // Check if meeting is in the past
        if cardData.startDate < Date() {
            throw CalendarActionError.meetingInPast
        }
        
        // Check if duration is reasonable
        if cardData.duration < 300 { // Less than 5 minutes
            throw CalendarActionError.durationTooShort
        }
        
        if cardData.duration > 28800 { // More than 8 hours
            throw CalendarActionError.durationTooLong
        }
        
        // Check if title is provided
        if cardData.eventTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw CalendarActionError.missingTitle
        }
        
        // Validate attendees
        for attendee in cardData.attendees {
            if !isValidEmail(attendee.email) {
                throw CalendarActionError.invalidAttendee(attendee.email)
            }
        }
    }
    
    private func checkForConflicts() async throws {
        if cardData.hasConflicts {
            let criticalConflicts = cardData.criticalConflicts
            if !criticalConflicts.isEmpty {
                let conflictTitles = criticalConflicts.map(\.conflictingEventTitle).joined(separator: ", ")
                throw CalendarActionError.criticalConflicts(conflictTitles)
            }
        }
    }
    
    private func executeCalendarAction() async throws -> CalendarActionResult {
        let request = createAPIRequest()
        let response = try await apiService.executeCalendarAction(request)
        return response
    }
    
    private func createAPIRequest() -> CalendarAPIRequest {
        return CalendarAPIRequest(
            actionType: cardData.actionType,
            eventTitle: cardData.eventTitle,
            startDate: cardData.startDate,
            endDate: cardData.endDate,
            attendees: cardData.attendees.map { $0.email },
            location: cardData.location,
            description: cardData.description,
            isRecurring: cardData.isRecurring,
            recurrenceRule: cardData.recurrenceRule
        )
    }
    
    private func handleSuccessfulExecution(_ result: CalendarActionResult) async {
        hapticFeedback.impactOccurred()
        
        print("Calendar action completed successfully: \(result)")
        
        // Analytics tracking
        AnalyticsService.shared.track(.actionCompleted, properties: [
            "agent_type": cardData.agentType.rawValue,
            "action_type": cardData.actionType,
            "attendee_count": cardData.attendees.count,
            "duration_minutes": Int(cardData.duration / 60),
            "has_location": cardData.location != nil,
            "is_recurring": cardData.isRecurring
        ])
    }
    
    private func handleExecutionError(_ error: Error) async {
        hapticFeedback.notificationOccurred(.error)
        
        let errorMessage = (error as? CalendarActionError)?.localizedDescription ?? error.localizedDescription
        self.errorMessage = errorMessage
        self.state = .failed(errorMessage)
        
        print("Calendar action failed: \(error)")
        
        // Analytics tracking
        AnalyticsService.shared.track(.actionFailed, properties: [
            "agent_type": cardData.agentType.rawValue,
            "action_type": cardData.actionType,
            "error": errorMessage
        ])
    }
    
    private func isValidEmail(_ email: String) -> Bool {
        let emailPattern = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        let regex = try! NSRegularExpression(pattern: emailPattern)
        return regex.firstMatch(in: email, options: [], range: NSRange(location: 0, length: email.count)) != nil
    }
}

// MARK: - Calendar Action Card View
struct CalendarActionCardView: View {
    @StateObject private var viewModel: CalendarActionCardViewModel
    
    init(cardData: CalendarActionData) {
        self._viewModel = StateObject(wrappedValue: CalendarActionCardViewModel(cardData: cardData))
    }
    
    var body: some View {
        ActionCard(cardData: viewModel.cardData) {
            VStack(alignment: .leading, spacing: 16) {
                // Meeting Details Section
                MeetingDetailsSection(cardData: viewModel.cardData)
                
                // Date and Time Section
                DateTimeSection(cardData: viewModel.cardData)
                
                // Attendees Section (if any)
                if !viewModel.cardData.attendees.isEmpty {
                    CalendarAttendeesView(attendees: viewModel.cardData.attendees)
                }
                
                // Location Section (if provided)
                if let location = viewModel.cardData.location {
                    LocationSection(location: location)
                }
                
                // Conflicts Warning (if any)
                if viewModel.cardData.hasConflicts {
                    ConflictsWarningView(conflicts: viewModel.cardData.conflicts)
                }
                
                // Recurrence Info (if recurring)
                if viewModel.cardData.isRecurring, let recurrence = viewModel.cardData.recurrenceRule {
                    RecurrenceInfoView(recurrence: recurrence)
                }
                
                // Error Message
                if let errorMessage = viewModel.errorMessage {
                    ErrorMessageView(message: errorMessage)
                }
                
                // Action Buttons
                ActionButtonsView(
                    state: viewModel.state,
                    isDestructive: viewModel.cardData.isDestructive,
                    onConfirm: { await viewModel.confirm() },
                    onCancel: viewModel.cancel,
                    onEdit: { await viewModel.edit() },
                    onRetry: { await viewModel.retry() }
                )
            }
        }
    }
}

// MARK: - Meeting Details Section
struct MeetingDetailsSection: View {
    let cardData: CalendarActionData
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "calendar.badge.plus")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Meeting Details")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                if cardData.isDestructive {
                    Label("Delete", systemImage: "trash")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
            
            VStack(alignment: .leading, spacing: 8) {
                // Title
                HStack {
                    Text("Title:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                Text(cardData.eventTitle)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .padding(.leading, 24)
                
                // Description (if provided)
                if let description = cardData.description, !description.isEmpty {
                    HStack {
                        Text("Description:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(.primary)
                        .padding(.leading, 24)
                }
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Date Time Section
struct DateTimeSection: View {
    let cardData: CalendarActionData
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "clock")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Date & Time")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text(cardData.durationText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Start")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(DateFormatter.shortDate.string(from: cardData.startDate))
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text(DateFormatter.shortTime.string(from: cardData.startDate))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(.secondary)
                    .font(.caption)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("End")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(DateFormatter.shortDate.string(from: cardData.endDate))
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text(DateFormatter.shortTime.string(from: cardData.endDate))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding(.leading, 24)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Calendar Attendees View
struct CalendarAttendeesView: View {
    let attendees: [EmailRecipient]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "person.2")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Attendees")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text("\(attendees.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(attendees.prefix(3)) { attendee in
                    CalendarAttendeeRow(attendee: attendee)
                }
                
                if attendees.count > 3 {
                    Text("and \(attendees.count - 3) more...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 32)
                }
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Calendar Attendee Row
struct CalendarAttendeeRow: View {
    let attendee: EmailRecipient
    
    var body: some View {
        HStack {
            Image(systemName: "person.circle")
                .foregroundColor(.secondary)
                .font(.caption)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(attendee.displayName)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                
                if attendee.displayName != attendee.email {
                    Text(attendee.email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Image(systemName: "envelope")
                .foregroundColor(.blue)
                .font(.caption)
        }
        .padding(.leading, 24)
    }
}

// MARK: - Location Section
struct LocationSection: View {
    let location: String
    
    var body: some View {
        HStack {
            Image(systemName: "location")
                .foregroundColor(.secondary)
                .font(.subheadline)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Location")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(location)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .padding(.leading, 24)
            }
            
            Spacer()
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Conflicts Warning View
struct ConflictsWarningView: View {
    let conflicts: [CalendarConflict]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                    .font(.subheadline)
                Text("Schedule Conflicts")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text("\(conflicts.count)")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(conflicts.prefix(3)) { conflict in
                    ConflictRow(conflict: conflict)
                }
                
                if conflicts.count > 3 {
                    Text("and \(conflicts.count - 3) more conflicts...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 32)
                }
            }
        }
        .padding(12)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Conflict Row
struct ConflictRow: View {
    let conflict: CalendarConflict
    
    var body: some View {
        HStack {
            Image(systemName: conflict.severity == .error ? "xmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundColor(conflict.severity == .error ? .red : .orange)
                .font(.caption)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(conflict.conflictingEventTitle)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                
                Text(DateFormatter.shortDateTime.string(from: conflict.conflictTime))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(.leading, 24)
    }
}

// MARK: - Recurrence Info View
struct RecurrenceInfoView: View {
    let recurrence: CalendarActionData.RecurrenceRule
    
    var body: some View {
        HStack {
            Image(systemName: "repeat")
                .foregroundColor(.secondary)
                .font(.subheadline)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Recurring Meeting")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                HStack {
                    Text("Repeats \(recurrence.frequency.displayText.lowercased())")
                        .font(.subheadline)
                        .foregroundColor(.primary)
                    
                    if recurrence.interval > 1 {
                        Text("every \(recurrence.interval)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.leading, 24)
                
                if let endDate = recurrence.endDate {
                    Text("Until \(DateFormatter.shortDate.string(from: endDate))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 24)
                } else if let count = recurrence.occurrenceCount {
                    Text("For \(count) occurrences")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 24)
                }
            }
            
            Spacer()
        }
        .padding(12)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Supporting Types
enum CalendarActionError: LocalizedError {
    case meetingInPast
    case durationTooShort
    case durationTooLong
    case missingTitle
    case invalidAttendee(String)
    case criticalConflicts(String)
    case networkError(String)
    
    var errorDescription: String? {
        switch self {
        case .meetingInPast:
            return "Cannot schedule meeting in the past"
        case .durationTooShort:
            return "Meeting duration is too short (minimum 5 minutes)"
        case .durationTooLong:
            return "Meeting duration is too long (maximum 8 hours)"
        case .missingTitle:
            return "Meeting title is required"
        case .invalidAttendee(let email):
            return "Invalid attendee email: \(email)"
        case .criticalConflicts(let conflicts):
            return "Critical scheduling conflicts: \(conflicts)"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}

struct CalendarAPIRequest {
    let actionType: String
    let eventTitle: String
    let startDate: Date
    let endDate: Date
    let attendees: [String]
    let location: String?
    let description: String?
    let isRecurring: Bool
    let recurrenceRule: CalendarActionData.RecurrenceRule?
}

// MARK: - Protocol Extension
extension APIServiceProtocol {
    func executeCalendarAction(_ request: CalendarAPIRequest) async throws -> CalendarActionResult {
        // Mock implementation - would integrate with real calendar API
        return CalendarActionResult(
            eventId: UUID().uuidString,
            status: "created",
            timestamp: Date(),
            attendeeStatus: request.attendees.map { email in
                CalendarActionResult.AttendeeStatus(
                    email: email,
                    responseStatus: .needsAction
                )
            }
        )
    }
}