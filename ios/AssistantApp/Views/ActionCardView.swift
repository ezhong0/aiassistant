//
//  ActionCardView.swift
//  AssistantApp
//
//  Created by Assistant on 8/25/25.
//

import SwiftUI

// MARK: - Generic Action Card Container
struct ActionCard<Content: View>: View {
    let cardData: any ActionCardData
    let content: () -> Content
    
    @State private var isExpanded: Bool = false
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Card Header
            ActionCardHeader(
                cardData: cardData,
                isExpanded: $isExpanded
            )
            
            // Card Content (specific to card type)
            if isExpanded {
                content()
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                    .transition(.opacity.combined(with: .slide))
            }
        }
        .background(cardBackgroundColor)
        .cornerRadius(12)
        .shadow(
            color: shadowColor,
            radius: isExpanded ? 8 : 4,
            x: 0,
            y: isExpanded ? 4 : 2
        )
        .animation(.easeInOut(duration: 0.3), value: isExpanded)
        .onTapGesture {
            withAnimation(.spring()) {
                isExpanded.toggle()
            }
        }
    }
    
    private var cardBackgroundColor: Color {
        Color(uiColor: colorScheme == .dark ? .secondarySystemGroupedBackground : .systemBackground)
    }
    
    private var shadowColor: Color {
        Color.black.opacity(colorScheme == .dark ? 0.3 : 0.1)
    }
}

// MARK: - Action Card Header
struct ActionCardHeader: View {
    let cardData: any ActionCardData
    @Binding var isExpanded: Bool
    
    var body: some View {
        HStack {
            // Agent Icon
            Image(systemName: cardData.agentType.icon)
                .foregroundColor(cardData.agentType.primaryColor)
                .font(.title2)
                .frame(width: 32, height: 32)
            
            VStack(alignment: .leading, spacing: 2) {
                // Title
                Text(cardData.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                // Subtitle
                if let subtitle = cardData.subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                // Metadata
                HStack(spacing: 8) {
                    if cardData.isDestructive {
                        Label("Destructive", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    
                    if let executionTime = cardData.estimatedExecutionTime {
                        Label("\(Int(executionTime))s", systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // Expand/Collapse Button
            Button(action: {
                withAnimation(.spring()) {
                    isExpanded.toggle()
                }
            }) {
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(16)
    }
}

// MARK: - Reusable Action Buttons
struct ActionButtonsView: View {
    let state: ActionCardState
    let isDestructive: Bool
    let onConfirm: () async -> Void
    let onCancel: () -> Void
    let onEdit: (() async -> Void)?
    let onRetry: (() async -> Void)?
    
    @State private var isConfirming = false
    
    var body: some View {
        VStack(spacing: 12) {
            // Progress bar for executing state
            if case .executing(let progress) = state {
                ProgressView(value: progress)
                    .progressViewStyle(LinearProgressViewStyle(tint: isDestructive ? .red : .blue))
            }
            
            // Action buttons
            HStack(spacing: 12) {
                switch state {
                case .pending:
                    Button("Cancel", action: onCancel)
                        .buttonStyle(SecondaryButtonStyle())
                    
                    if let onEdit = onEdit {
                        Button("Edit") { 
                            Task { await onEdit() }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                    
                    Button(isDestructive ? "Confirm Delete" : "Confirm") { 
                        isConfirming = true
                        Task { 
                            await onConfirm()
                            isConfirming = false
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle(isDestructive: isDestructive))
                    .disabled(isConfirming)
                    
                case .executing:
                    Button("Cancel", action: onCancel)
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(true)
                    
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text(state.displayText)
                            .font(.caption)
                    }
                    
                case .completed:
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Completed")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                case .failed:
                    Button("Dismiss", action: onCancel)
                        .buttonStyle(SecondaryButtonStyle())
                    
                    if let onRetry = onRetry {
                        Button("Retry") { 
                            Task { await onRetry() }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    
                case .cancelled:
                    HStack {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.orange)
                        Text("Cancelled")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                default:
                    EmptyView()
                }
            }
        }
    }
}

// MARK: - Error Message View
struct ErrorMessageView: View {
    let message: String
    
    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)
            Text(message)
                .font(.caption)
                .foregroundColor(.red)
                .multilineTextAlignment(.leading)
            Spacer()
        }
        .padding(12)
        .background(Color.red.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Custom Button Styles
struct PrimaryButtonStyle: ButtonStyle {
    var isDestructive: Bool = false
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isDestructive ? Color.red : Color.blue)
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.primary)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.secondary, lineWidth: 1)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(uiColor: .systemBackground))
                            .opacity(configuration.isPressed ? 0.8 : 1.0)
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}