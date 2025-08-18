# Current n8n Workflow Analysis

## Overview
This is a complex multi-agent system with Telegram integration that routes user requests to specialized AI agents for different tasks (email, calendar, contacts, content creation).

## Main Entry Points

### **Telegram Trigger**
- **Node**: `Telegram Trigger`
- **Purpose**: Receives messages from Telegram (text or voice)
- **Triggers**: The entire workflow when a Telegram message is received

## Primary Flow Paths

### **Path 1: Voice Message Flow**
```
Telegram Trigger → Switch → Download Voice File → Transcribe Audio → Ultimate Assistant
```

1. **Telegram Trigger** receives voice message
2. **Switch** detects voice message (checks for `voice.file_id`)
3. **Download Voice File** downloads the voice file from Telegram
4. **Transcribe Audio** converts audio to text using OpenAI Whisper
5. **Ultimate Assistant** receives transcribed text

### **Path 2: Text Message Flow**
```
Telegram Trigger → Switch → Set 'Text' → Ultimate Assistant
```

1. **Telegram Trigger** receives text message
2. **Switch** detects text message (checks for `message.text`)
3. **Set 'Text'** extracts text from message
4. **Ultimate Assistant** receives text directly

## Central Orchestrator: Ultimate Assistant

### **Role**: Master Router Agent
- **LLM**: Uses OpenRouter Chat Model
- **Memory**: Simple Memory with session-based storage
- **Purpose**: Routes user requests to appropriate specialized agents

### **Available Tools**:
- **emailAgent**: Email operations (sub-workflow)
- **calendarAgent**: Calendar operations (sub-workflow)  
- **contactAgent**: Contact management (sub-workflow)
- **contentCreator**: Blog/content creation (sub-workflow)
- **Tavily**: Web search
- **Calculator**: Mathematical operations
- **Think**: Internal reasoning/planning

### **Decision Logic**:
The Ultimate Assistant analyzes user input and calls the appropriate tool(s). For complex tasks requiring multiple agents, it coordinates between them (e.g., getting contact info before sending email).

## Specialized Agent Sub-Workflows

### **Email Agent Sub-Workflow**
**Trigger**: `When Executed by Another Workflow`
**Available Tools**:
- **Send Email**: Direct email sending
- **Get Emails**: Retrieve emails with filters
- **Create Draft**: Create email drafts
- **Email Reply**: Reply to existing emails
- **Get Labels**: Retrieve Gmail labels
- **Label Emails**: Apply labels to emails
- **Mark Unread**: Mark emails as unread

**Flow**:
```
Workflow Trigger → Email Agent1 → Success/Try Again → Response
```

**LLM**: OpenAI GPT-4o
**Error Handling**: Returns "Unable to perform task" on failure

### **Calendar Agent Sub-Workflow**
**Available Tools**:
- **Create Event with Attendee**: Events with participants
- **Create Event**: Solo events
- **Get Events**: Retrieve calendar events
- **Delete Event**: Remove events
- **Update Event**: Modify existing events

**Flow**:
```
Calendar Actions → Calendar Agent1 → Success1/Try Again3 → Response
```

**LLM**: OpenAI GPT-4o

### **Contact Agent Sub-Workflow**
**Available Tools**:
- **Get Contacts**: Search Airtable contacts
- **Add or Update Contact**: Manage contact records

**Data Storage**: Airtable database
**LLM**: OpenAI GPT-4o

### **Content Creator Agent Sub-Workflow**
**Available Tools**:
- **Tavily1**: Web search for research

**Flow**:
```
Content Request → Content Creator Agent1 → Response1/Try Again1
```

**LLM**: Anthropic Claude
**Purpose**: Creates blog posts with web research

## Response Flow

### **Final Response Path**:
```
Ultimate Assistant → Response → Telegram (back to user)
```

All agent results flow back through the Ultimate Assistant, which formats and sends the final response to the Telegram user.

## Key Features

### **Multi-Modal Input**:
- Text messages (direct processing)
- Voice messages (transcribed via Whisper)

### **Session Memory**:
- Maintains conversation context via Simple Memory
- Session ID based on Telegram chat ID

### **Error Handling**:
- Each agent has Try Again/Success paths
- Graceful degradation with user-friendly error messages

### **Scalable Architecture**:
- Modular agent design
- Each agent is a separate sub-workflow
- Easy to add new capabilities

## Data Flow Summary

1. **Input**: Telegram message (text/voice)
2. **Processing**: Voice transcription if needed
3. **Routing**: Ultimate Assistant analyzes and routes to appropriate agent(s)
4. **Execution**: Specialized agents perform actions using their tools
5. **Response**: Results flow back through Ultimate Assistant to Telegram

This architecture allows for complex, multi-step tasks while maintaining clean separation of concerns between different functional areas (email, calendar, contacts, etc.).