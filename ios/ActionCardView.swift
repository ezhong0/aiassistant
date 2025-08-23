//
//  ActionCardView.swift
//  AssistantApp
//
//  Individual action card component with glassmorphism design
//

import SwiftUI

struct ActionCardView: View {
    let card: ActionCard
    let onApprove: () async -> Void
    let onDismiss: () -> Void
    let onEdit: (ActionType) -> Void
    let onTap: () -> Void
    
    @State private var isExpanded = false
    @State private var dragOffset = CGSize.zero
    @State private var showingEditSheet = false
    
    private let cardHeight: CGFloat = 120
    private let expandedHeight: CGFloat = 200
    private let dismissThreshold: CGFloat = 100
    
    var body: some View {
        VStack(spacing: 0) {
            // Main card content
            cardContent
                .frame(height: isExpanded ? expandedHeight : cardHeight)
                .background(cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
                .scaleEffect(dragOffset.width != 0 ? 0.95 : 1.0)
                .rotationEffect(.degrees(dragOffset.width / 20))
                .offset(dragOffset)
                .gesture(swipeGesture)
                .onTapGesture {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                    onTap()
                }
            
            // Action buttons (shown when expanded or for confirmation-required actions)
            if isExpanded || (card.requiresConfirmation && card.canBeApproved) {
                actionButtons
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: isExpanded)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: dragOffset)
        .sheet(isPresented: $showingEditSheet) {
            ActionEditSheet(
                card: card,
                onSave: onEdit,
                onCancel: { showingEditSheet = false }
            )
        }
    }
    
    // MARK: - Card Content
    
    private var cardContent: some View {
        VStack(spacing: 0) {
            // Header section
            HStack(alignment: .top, spacing: 12) {
                // Icon
                iconView
                
                // Content
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(card.title)
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                            .lineLimit(isExpanded ? 3 : 1)
                        
                        Spacer()
                        
                        statusBadge
                    }
                    
                    Text(card.subtitle)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(isExpanded ? 3 : 2)
                    
                    if isExpanded {
                        Spacer().frame(height: 8)
                        
                        Text(card.detailContent)
                            .font(.body)
                            .foregroundColor(.primary)
                            .lineLimit(4)
                            .padding(.top, 4)
                    }
                }
                
                Spacer()
            }
            .padding(16)
            
            // Progress bar for executing actions
            if card.status == .executing {
                progressBar
            }
            
            Spacer()
        }
    }
    
    private var iconView: some View {
        ZStack {
            Circle()
                .fill(card.color.opacity(0.15))
                .frame(width: 44, height: 44)
            
            Image(systemName: card.icon)
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(card.color)
        }
    }
    
    private var statusBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(card.status.color)
                .frame(width: 8, height: 8)
            
            Text(card.status.displayName)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(card.status.color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(card.status.color.opacity(0.1))
        .cornerRadius(12)
    }
    
    private var progressBar: some View {
        VStack(spacing: 4) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .frame(height: 3)
                        .cornerRadius(1.5)
                    
                    Rectangle()
                        .fill(card.color)
                        .frame(
                            width: geometry.size.width * CGFloat(card.executionProgress),
                            height: 3
                        )
                        .cornerRadius(1.5)
                        .animation(.easeInOut(duration: 0.5), value: card.executionProgress)
                }
            }
            .frame(height: 3)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        HStack(spacing: 12) {
            // Dismiss button
            Button(action: onDismiss) {
                HStack(spacing: 6) {
                    Image(systemName: "xmark")
                    Text("Dismiss")
                }
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.red)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.red.opacity(0.1))
                .cornerRadius(16)
            }
            
            Spacer()
            
            // Edit button (if editable)
            if card.isEditable {
                Button(action: { showingEditSheet = true }) {
                    HStack(spacing: 6) {
                        Image(systemName: "pencil")
                        Text("Edit")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(16)
                }
            }
            
            // Approve button (if can be approved)
            if card.canBeApproved {
                Button(action: {
                    Task {
                        await onApprove()
                    }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                        Text("Approve")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(card.color)
                    .cornerRadius(16)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground).opacity(0.8))
    }
    
    // MARK: - Background and Effects
    
    private var cardBackground: some View {
        ZStack {
            // Base background
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
            
            // Glassmorphism effect
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [
                            card.color.opacity(0.05),
                            card.color.opacity(0.02),
                            Color.clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            // Border
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        colors: [
                            card.color.opacity(0.3),
                            card.color.opacity(0.1),
                            Color.clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        }
    }
    
    // MARK: - Gestures
    
    private var swipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                // Only allow horizontal swipes
                if abs(value.translation.x) > abs(value.translation.y) {
                    dragOffset = CGSize(width: value.translation.x, height: 0)
                }
            }
            .onEnded { value in
                withAnimation(.spring()) {
                    if abs(value.translation.x) > dismissThreshold {
                        // Determine swipe direction and action
                        if value.translation.x > 0 {
                            // Swipe right - approve (if possible)
                            if card.canBeApproved {
                                Task {
                                    await onApprove()
                                }
                            }
                        } else {
                            // Swipe left - dismiss
                            onDismiss()
                        }
                    }
                    
                    dragOffset = .zero
                }
            }
    }
}

// MARK: - Action Edit Sheet

struct ActionEditSheet: View {
    let card: ActionCard
    let onSave: (ActionType) -> Void
    let onCancel: () -> Void
    
    @State private var editedType: ActionType
    
    init(card: ActionCard, onSave: @escaping (ActionType) -> Void, onCancel: @escaping () -> Void) {
        self.card = card
        self.onSave = onSave
        self.onCancel = onCancel
        self._editedType = State(initialValue: card.type)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    
                    // Action type specific editing UI
                    switch editedType {
                    case .sendEmail(let recipient, let subject, let body):
                        emailEditSection(recipient: recipient, subject: subject, body: body)
                        
                    case .scheduleEvent(let title, let date, let duration, let participants):
                        eventEditSection(title: title, date: date, duration: duration, participants: participants)
                        
                    case .createNote(let title, let content):
                        noteEditSection(title: title, content: content)
                        
                    default:
                        Text("Editing not supported for this action type")
                            .foregroundColor(.secondary)
                            .padding()
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Edit Action")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    onCancel()
                },
                trailing: Button("Save") {
                    onSave(editedType)
                    onCancel()
                }
                .fontWeight(.semibold)
            )
        }
    }
    
    @ViewBuilder
    private func emailEditSection(recipient: String, subject: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Recipient")
                    .font(.headline)
                TextField("Email address", text: .constant(recipient))
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .disabled(true) // For now, don't allow editing recipient
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Subject")
                    .font(.headline)
                TextField("Email subject", text: Binding(
                    get: { subject },
                    set: { newSubject in
                        editedType = .sendEmail(recipient: recipient, subject: newSubject, body: body)
                    }
                ))
                .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Message")
                    .font(.headline)
                TextEditor(text: Binding(
                    get: { body },
                    set: { newBody in
                        editedType = .sendEmail(recipient: recipient, subject: subject, body: newBody)
                    }
                ))
                .frame(minHeight: 120)
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
        }
    }
    
    @ViewBuilder
    private func eventEditSection(title: String, date: Date, duration: TimeInterval, participants: [String]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Event Title")
                    .font(.headline)
                TextField("Meeting title", text: Binding(
                    get: { title },
                    set: { newTitle in
                        editedType = .scheduleEvent(title: newTitle, date: date, duration: duration, participants: participants)
                    }
                ))
                .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Date & Time")
                    .font(.headline)
                DatePicker("", selection: Binding(
                    get: { date },
                    set: { newDate in
                        editedType = .scheduleEvent(title: title, date: newDate, duration: duration, participants: participants)
                    }
                ), displayedComponents: [.date, .hourAndMinute])
                .datePickerStyle(.compact)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Duration")
                    .font(.headline)
                Picker("Duration", selection: Binding(
                    get: { duration },
                    set: { newDuration in
                        editedType = .scheduleEvent(title: title, date: date, duration: newDuration, participants: participants)
                    }
                )) {
                    Text("15 minutes").tag(TimeInterval(900))
                    Text("30 minutes").tag(TimeInterval(1800))
                    Text("45 minutes").tag(TimeInterval(2700))
                    Text("1 hour").tag(TimeInterval(3600))
                    Text("2 hours").tag(TimeInterval(7200))
                }
                .pickerStyle(.segmented)
            }
        }
    }
    
    @ViewBuilder
    private func noteEditSection(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Note Title")
                    .font(.headline)
                TextField("Note title", text: Binding(
                    get: { title },
                    set: { newTitle in
                        editedType = .createNote(title: newTitle, content: content)
                    }
                ))
                .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Content")
                    .font(.headline)
                TextEditor(text: Binding(
                    get: { content },
                    set: { newContent in
                        editedType = .createNote(title: title, content: newContent)
                    }
                ))
                .frame(minHeight: 200)
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ActionCardView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            ForEach(ActionCard.mockCards.prefix(3)) { card in
                ActionCardView(
                    card: card,
                    onApprove: { },
                    onDismiss: { },
                    onEdit: { _ in },
                    onTap: { }
                )
            }
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
}
#endif