# Natural Language Logging Configuration

## Environment Variables

Add these to your `.env` file to enable natural language logging:

```bash
# Enable natural language logging to see AI agent communication flow
NATURAL_LANGUAGE_LOGGING=true

# Natural language log level (intent, plan, agent, draft, flow, error, warn, info, debug)
# - intent: Only intent analysis logs
# - plan: Intent + plan creation logs  
# - agent: Intent + plan + agent communication logs
# - draft: Intent + plan + agent + draft workflow logs
# - flow: All natural language logs including complete flows
# - debug: All logs including technical details
NATURAL_LANGUAGE_LOG_LEVEL=agent
```

## Example Configurations

### For Development Debugging:
```bash
NATURAL_LANGUAGE_LOGGING=true
NATURAL_LANGUAGE_LOG_LEVEL=debug
```

### For Production Monitoring:
```bash
NATURAL_LANGUAGE_LOGGING=true
NATURAL_LANGUAGE_LOG_LEVEL=flow
```

### For Minimal Logging:
```bash
NATURAL_LANGUAGE_LOGGING=true
NATURAL_LANGUAGE_LOG_LEVEL=intent
```

### To Disable Natural Language Logging:
```bash
NATURAL_LANGUAGE_LOGGING=false
```

## Log Levels Explained

- **intent** (0): Intent analysis results - shows how AI interprets user requests
- **plan** (1): Plan creation - shows step-by-step planning decisions
- **agent** (2): Agent communication - shows natural language requests/responses between agents
- **draft** (3): Draft workflow - shows draft creation, execution, and modifications
- **flow** (4): Complete natural language flow - shows end-to-end user request processing
- **error** (5): Errors (always enabled)
- **warn** (6): Warnings
- **info** (7): General information
- **debug** (8): Debug information

## Log Files

Natural language logs are written to:
- Console output (colored by log level)
- `logs/natural-language-YYYY-MM-DD.log` (daily rotation)

## Usage

The natural language logger automatically captures:
1. **Intent Analysis**: How the MasterAgent interprets user requests
2. **Plan Creation**: Step-by-step workflow planning decisions
3. **Agent Communication**: Natural language requests and responses between agents
4. **Draft Workflow**: Draft creation, execution, and user confirmations
5. **Complete Flow**: End-to-end natural language processing

## Benefits

- **Visual Distinction**: Each natural language event type has its own color and priority
- **Complete Flow Visibility**: See the entire user request → intent → plan → execution → response flow
- **Easy Filtering**: Filter logs by natural language event type
- **Separate Log Files**: Natural language logs in separate files from technical logs
- **Environment Control**: Enable/disable with environment variables
