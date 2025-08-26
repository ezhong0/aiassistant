//
//  EmailActionCardView.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import SwiftUI

// MARK: - Email Action Card View Model
@MainActor
class EmailActionCardViewModel: ObservableObject, ActionCardViewModeling {
    let cardData: EmailActionData
    @Published var state: ActionCardState = .pending
    @Published var progress: Double = 0.0
    @Published var errorMessage: String?
    
    private let apiService: APIServiceProtocol
    private let hapticFeedback = UIImpactFeedbackGenerator(style: .medium)
    
    init(cardData: EmailActionData, apiService: APIServiceProtocol = APIService.shared) {
        self.cardData = cardData
        self.apiService = apiService
    }
    
    func confirm() async {
        hapticFeedback.impactOccurred()
        state = .confirming
        
        do {
            state = .executing(progress: 0.1)
            
            // Step 1: Validate recipients
            try await validateRecipients(cardData.recipients)
            state = .executing(progress: 0.3)
            
            // Step 2: Perform preflight checks
            try await performPreflightChecks()
            state = .executing(progress: 0.5)
            
            // Step 3: Execute email action
            let result = try await executeEmailAction()
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
        // For now, just show that edit was requested
        print("Edit requested for email action: \(cardData.actionType)")
    }
    
    func retry() async {
        guard case .failed = state else { return }
        errorMessage = nil
        await confirm()
    }
    
    // MARK: - Private Implementation
    private func validateRecipients(_ recipients: [EmailRecipient]) async throws {
        for recipient in recipients {
            if !recipient.isVerified {
                throw EmailActionError.invalidRecipient(recipient.email)
            }
            
            // Basic email validation
            if !isValidEmail(recipient.email) {
                throw EmailActionError.invalidEmailFormat(recipient.email)
            }
        }
    }
    
    private func performPreflightChecks() async throws {
        // Check for large body content
        if cardData.bodyPreview.count > 50000 {
            throw EmailActionError.contentTooLarge
        }
        
        // Check for attachments size
        let totalAttachmentSize = cardData.attachments.reduce(0) { $0 + $1.size }
        if totalAttachmentSize > 25 * 1024 * 1024 { // 25MB limit
            throw EmailActionError.attachmentsTooLarge
        }
        
        // Check for empty recipients
        if cardData.recipients.isEmpty {
            throw EmailActionError.noRecipients
        }
    }
    
    private func executeEmailAction() async throws -> EmailActionResult {
        // This would integrate with your existing API service
        let request = createAPIRequest()
        let response = try await apiService.executeEmailAction(request)
        return response
    }
    
    private func createAPIRequest() -> EmailAPIRequest {
        return EmailAPIRequest(
            actionType: cardData.actionType,
            recipients: cardData.recipients.map { $0.email },
            subject: cardData.subject,
            body: cardData.bodyPreview, // In real implementation, this would be the full body
            threadId: cardData.threadId,
            attachments: cardData.attachments.map { $0.name }
        )
    }
    
    private func handleSuccessfulExecution(_ result: EmailActionResult) async {
        hapticFeedback.impactOccurred()
        
        // Log success
        print("Email action completed successfully: \(result)")
        
        // Analytics tracking
        AnalyticsService.shared.track(.actionCompleted, properties: [
            "agent_type": cardData.agentType.rawValue,
            "action_type": cardData.actionType,
            "recipient_count": cardData.recipients.count,
            "has_attachments": !cardData.attachments.isEmpty
        ])
    }
    
    private func handleExecutionError(_ error: Error) async {
        hapticFeedback.notificationOccurred(.error)
        
        let errorMessage = (error as? EmailActionError)?.localizedDescription ?? error.localizedDescription
        self.errorMessage = errorMessage
        self.state = .failed(errorMessage)
        
        // Log error
        print("Email action failed: \(error)")
        
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

// MARK: - Email Action Card View
struct EmailActionCardView: View {
    @StateObject private var viewModel: EmailActionCardViewModel
    @State private var isExpanded: Bool = true
    
    init(cardData: EmailActionData) {
        self._viewModel = StateObject(wrappedValue: EmailActionCardViewModel(cardData: cardData))
    }
    
    var body: some View {
        ActionCard(cardData: viewModel.cardData) {
            VStack(alignment: .leading, spacing: 16) {
                // Recipients Section
                EmailRecipientsView(recipients: viewModel.cardData.recipients)
                
                // Email Content Section
                EmailContentSection(
                    subject: viewModel.cardData.subject,
                    bodyPreview: viewModel.cardData.bodyPreview,
                    priority: viewModel.cardData.priority
                )
                
                // Attachments Section (if any)
                if !viewModel.cardData.attachments.isEmpty {
                    EmailAttachmentsView(attachments: viewModel.cardData.attachments)
                }
                
                // Thread Info (for replies/forwards)
                if let threadId = viewModel.cardData.threadId {
                    EmailThreadInfoView(threadId: threadId, actionType: viewModel.cardData.actionType)
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

// MARK: - Email Recipients View
struct EmailRecipientsView: View {
    let recipients: [EmailRecipient]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "person.2")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Recipients")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text("\(recipients.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(recipients.prefix(3)) { recipient in
                    EmailRecipientRow(recipient: recipient)
                }
                
                if recipients.count > 3 {
                    Text("and \(recipients.count - 3) more...")
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

// MARK: - Email Recipient Row
struct EmailRecipientRow: View {
    let recipient: EmailRecipient
    
    var body: some View {
        HStack {
            Image(systemName: recipient.isVerified ? "checkmark.circle.fill" : "questionmark.circle.fill")
                .foregroundColor(recipient.isVerified ? .green : .orange)
                .font(.caption)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(recipient.displayName)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                
                if recipient.displayName != recipient.email {
                    Text(recipient.email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
        }
        .padding(.leading, 24)
    }
}

// MARK: - Email Content Section
struct EmailContentSection: View {
    let subject: String
    let bodyPreview: String
    let priority: EmailActionData.EmailPriority
    
    @State private var isBodyExpanded: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "envelope")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Email Content")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                if priority != .normal {
                    Label(priority.displayText, systemImage: priority == .high ? "exclamationmark" : "arrow.down")
                        .font(.caption)
                        .foregroundColor(priority == .high ? .red : .secondary)
                }
            }
            
            // Subject
            if !subject.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Subject:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(subject)
                        .font(.subheadline)
                        .foregroundColor(.primary)
                        .fontWeight(.medium)
                }
                .padding(.leading, 24)
            }
            
            // Body Preview
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Message:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    if bodyPreview.count > 150 {
                        Button(isBodyExpanded ? "Show Less" : "Show More") {
                            withAnimation(.easeInOut) {
                                isBodyExpanded.toggle()
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.blue)
                    }
                }
                
                Text(isBodyExpanded ? bodyPreview : String(bodyPreview.prefix(150)) + (bodyPreview.count > 150 ? "..." : ""))
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .lineLimit(isBodyExpanded ? nil : 3)
                    .animation(.easeInOut, value: isBodyExpanded)
            }
            .padding(.leading, 24)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Email Attachments View
struct EmailAttachmentsView: View {
    let attachments: [AttachmentInfo]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "paperclip")
                    .foregroundColor(.secondary)
                    .font(.subheadline)
                Text("Attachments")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text("\(attachments.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(attachments) { attachment in
                    EmailAttachmentRow(attachment: attachment)
                }
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Email Attachment Row
struct EmailAttachmentRow: View {
    let attachment: AttachmentInfo
    
    var body: some View {
        HStack {
            Image(systemName: iconForMimeType(attachment.mimeType))
                .foregroundColor(.secondary)
                .font(.caption)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(attachment.name)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                
                Text(ByteCountFormatter.string(fromByteCount: attachment.size, countStyle: .file))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: attachment.isUploaded ? "checkmark.circle.fill" : "arrow.up.circle")
                .foregroundColor(attachment.isUploaded ? .green : .orange)
                .font(.caption)
        }
        .padding(.leading, 24)
    }
    
    private func iconForMimeType(_ mimeType: String) -> String {
        if mimeType.hasPrefix("image/") {
            return "photo"
        } else if mimeType.hasPrefix("video/") {
            return "video"
        } else if mimeType.contains("pdf") {
            return "doc.richtext"
        } else if mimeType.contains("word") || mimeType.contains("document") {
            return "doc.text"
        } else if mimeType.contains("excel") || mimeType.contains("spreadsheet") {
            return "tablecells"
        } else {
            return "doc"
        }
    }
}

// MARK: - Email Thread Info View
struct EmailThreadInfoView: View {
    let threadId: String
    let actionType: String
    
    var body: some View {
        HStack {
            Image(systemName: iconForActionType)
                .foregroundColor(.secondary)
                .font(.subheadline)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(titleForActionType)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                
                Text("Thread ID: \(threadId.prefix(8))...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(8)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(6)
    }
    
    private var iconForActionType: String {
        switch actionType {
        case "reply_email": return "arrowshape.turn.up.left"
        case "forward_email": return "arrowshape.turn.up.right"
        default: return "envelope"
        }
    }
    
    private var titleForActionType: String {
        switch actionType {
        case "reply_email": return "Replying to conversation"
        case "forward_email": return "Forwarding message"
        default: return "Part of conversation"
        }
    }
}

// MARK: - Supporting Types
enum EmailActionError: LocalizedError {
    case invalidRecipient(String)
    case invalidEmailFormat(String)
    case contentTooLarge
    case attachmentsTooLarge
    case noRecipients
    case networkError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidRecipient(let email):
            return "Invalid recipient: \(email)"
        case .invalidEmailFormat(let email):
            return "Invalid email format: \(email)"
        case .contentTooLarge:
            return "Email content is too large"
        case .attachmentsTooLarge:
            return "Attachments exceed size limit (25MB)"
        case .noRecipients:
            return "No recipients specified"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}

struct EmailAPIRequest {
    let actionType: String
    let recipients: [String]
    let subject: String
    let body: String
    let threadId: String?
    let attachments: [String]
}

// MARK: - Protocol Extensions
protocol APIServiceProtocol {
    func executeEmailAction(_ request: EmailAPIRequest) async throws -> EmailActionResult
}

extension APIService: APIServiceProtocol {
    func executeEmailAction(_ request: EmailAPIRequest) async throws -> EmailActionResult {
        // This would be implemented to call your existing backend
        // For now, return a mock result
        return EmailActionResult(
            messageId: UUID().uuidString,
            threadId: request.threadId ?? UUID().uuidString,
            status: "sent",
            timestamp: Date(),
            deliveryStatus: .sent
        )
    }
}

// MARK: - Analytics Service Mock
class AnalyticsService {
    static let shared = AnalyticsService()
    private init() {}
    
    enum Event {
        case actionCompleted
        case actionCancelled
        case actionFailed
    }
    
    func track(_ event: Event, properties: [String: Any]) {
        // Mock implementation - would integrate with real analytics
        print("Analytics: \(event) - \(properties)")
    }
}