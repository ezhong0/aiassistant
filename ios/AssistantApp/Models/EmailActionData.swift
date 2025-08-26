//
//  EmailActionData.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import Foundation

// MARK: - Email Action Cards
struct EmailActionData: ActionCardData {
    let id = UUID()
    let agentType: AgentType = .email
    let actionType: String
    let title: String
    let subtitle: String?
    let isDestructive: Bool = false
    let requiresConfirmation: Bool = true
    let estimatedExecutionTime: TimeInterval? = 2.0
    
    // Email-specific properties
    let recipients: [EmailRecipient]
    let subject: String
    let bodyPreview: String
    let attachments: [AttachmentInfo]
    let threadId: String?
    let isDraft: Bool
    let priority: EmailPriority
    
    enum EmailPriority: String, CaseIterable {
        case normal = "normal"
        case high = "high"
        case low = "low"
        
        var displayText: String {
            switch self {
            case .normal: return "Normal"
            case .high: return "High Priority"
            case .low: return "Low Priority"
            }
        }
    }
    
    // MARK: - Factory Methods
    static func sendEmail(
        to recipients: [EmailRecipient],
        subject: String,
        body: String,
        attachments: [AttachmentInfo] = [],
        priority: EmailPriority = .normal
    ) -> EmailActionData {
        let recipientNames = recipients.map(\.displayName).joined(separator: ", ")
        let subtitle = recipients.count > 3 ? 
            "\(recipients.prefix(2).map(\.displayName).joined(separator: ", ")) and \(recipients.count - 2) others" :
            recipientNames
            
        return EmailActionData(
            actionType: "send_email",
            title: "Send Email",
            subtitle: "To \(subtitle)",
            recipients: recipients,
            subject: subject,
            bodyPreview: String(body.prefix(150)),
            attachments: attachments,
            threadId: nil,
            isDraft: false,
            priority: priority
        )
    }
    
    static func replyToEmail(
        threadId: String,
        to recipients: [EmailRecipient],
        subject: String,
        body: String
    ) -> EmailActionData {
        let recipientNames = recipients.map(\.displayName).joined(separator: ", ")
        
        return EmailActionData(
            actionType: "reply_email",
            title: "Reply to Email",
            subtitle: "To \(recipientNames)",
            recipients: recipients,
            subject: subject,
            bodyPreview: String(body.prefix(150)),
            attachments: [],
            threadId: threadId,
            isDraft: false,
            priority: .normal
        )
    }
    
    static func forwardEmail(
        originalThreadId: String,
        to recipients: [EmailRecipient],
        subject: String,
        body: String,
        attachments: [AttachmentInfo] = []
    ) -> EmailActionData {
        let recipientNames = recipients.map(\.displayName).joined(separator: ", ")
        
        return EmailActionData(
            actionType: "forward_email",
            title: "Forward Email",
            subtitle: "To \(recipientNames)",
            recipients: recipients,
            subject: subject,
            bodyPreview: String(body.prefix(150)),
            attachments: attachments,
            threadId: originalThreadId,
            isDraft: false,
            priority: .normal
        )
    }
    
    static func createDraft(
        to recipients: [EmailRecipient],
        subject: String,
        body: String,
        attachments: [AttachmentInfo] = []
    ) -> EmailActionData {
        let recipientNames = recipients.map(\.displayName).joined(separator: ", ")
        
        return EmailActionData(
            actionType: "create_draft",
            title: "Save as Draft",
            subtitle: "To \(recipientNames)",
            recipients: recipients,
            subject: subject,
            bodyPreview: String(body.prefix(150)),
            attachments: attachments,
            threadId: nil,
            isDraft: true,
            priority: .normal
        )
    }
}

// MARK: - Email Action Result
struct EmailActionResult: Codable {
    let messageId: String?
    let threadId: String?
    let status: String
    let timestamp: Date
    let deliveryStatus: DeliveryStatus?
    
    enum DeliveryStatus: String, Codable {
        case sent = "sent"
        case queued = "queued"
        case delivered = "delivered"
        case failed = "failed"
    }
}