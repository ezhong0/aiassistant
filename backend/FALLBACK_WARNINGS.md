# 🚨 Enhanced Fallback Warning System

## Overview

The AIAgent framework now includes a comprehensive fallback warning system that provides **high-visibility alerts** when fallbacks are triggered. This ensures you can easily detect when the system is not operating at full capacity.

## 🎯 **What You'll See**

### **Console Warnings (Development Mode)**
```
================================================================================
⚠️ HIGH PRIORITY FALLBACK
Agent: emailAgent
Fallback Type: AI Planning → Manual Execution
Reason: OpenAI service unavailable or not configured
Time: 2024-01-15T10:30:45.123Z
Context: { sessionId: 'abc123', userId: 'user456' }
================================================================================
```

### **Structured Log Warnings**
```json
{
  "level": "warn",
  "message": "⚠️ HIGH PRIORITY FALLBACK - AI Planning → Manual Execution",
  "agent": "emailAgent",
  "fallbackType": "AI Planning → Manual Execution",
  "reason": "OpenAI service unavailable or not configured",
  "severity": "HIGH",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "fallbackMetrics": {
    "agentName": "emailAgent",
    "aiPlanningEnabled": false,
    "openaiAvailable": false,
    "fallbackTimestamp": "2024-01-15T10:30:45.123Z"
  }
}
```

## 🚨 **Severity Levels**

| Severity | Icon | When Triggered |
|----------|------|----------------|
| **CRITICAL** | 🚨 | Agent not found, system unavailable |
| **HIGH** | ⚠️ | Service unavailable, execution failed |
| **MEDIUM** | ⚡ | AI planning failed, retries exhausted |
| **LOW** | ℹ️ | Configuration fallback, unsuitable query |

## 🔍 **Fallback Types Detected**

### 1. **AI Planning → Manual Execution**
- **Triggers**: OpenAI service unavailable, planning failed, timeout, unsuitable query
- **Severity**: HIGH (service issues) / MEDIUM (planning issues) / LOW (unsuitable query)

### 2. **Retry Strategy Fallback**
- **Triggers**: All retry attempts exhausted
- **Severity**: HIGH (fail strategy) / MEDIUM (retry/queue strategy)

### 3. **Service Availability Fallback**
- **Triggers**: External services (Gmail, Calendar, Contact) unavailable
- **Severity**: HIGH

### 4. **Timeout Fallback**
- **Triggers**: Operations exceeding timeout limits
- **Severity**: MEDIUM

### 5. **Configuration Fallback**
- **Triggers**: Using fallback values due to missing config
- **Severity**: LOW

### 6. **Agent Availability Fallback**
- **Triggers**: Agent not found or disabled
- **Severity**: CRITICAL

## 🛠️ **How to Use**

### **For Developers**

The warning system is automatically integrated into all agents. You can also manually trigger warnings:

```typescript
// In your agent subclass
this.logAIPlanningFallback(error, 'planning_failed', context);
this.logRetryFallback('email_send', 3, 3, error, 'retry');
this.logServiceFallback('Gmail', 'send_email', 'unavailable');
this.logTimeoutFallback('email_processing', 30000);
this.logConfigFallback('api_key', 'not provided', 'default_value');
```

### **For Monitoring**

Search logs for these patterns:
- `🚨 CRITICAL FALLBACK` - Immediate attention required
- `⚠️ HIGH PRIORITY FALLBACK` - Service issues
- `⚡ MEDIUM FALLBACK` - Performance issues
- `ℹ️ LOW IMPACT FALLBACK` - Configuration issues

### **For Testing**

Run the test script to see fallback warnings in action:

```bash
cd backend
npm run build
node test-fallback-warnings.js
```

## 📊 **Monitoring Integration**

The structured log format makes it easy to integrate with monitoring systems:

```javascript
// Example: Count fallbacks by severity
const fallbackCounts = logs
  .filter(log => log.message.includes('FALLBACK'))
  .reduce((acc, log) => {
    acc[log.severity] = (acc[log.severity] || 0) + 1;
    return acc;
  }, {});

// Example: Alert on critical fallbacks
if (log.severity === 'CRITICAL') {
  sendAlert(`Critical fallback detected: ${log.fallbackType}`);
}
```

## 🎛️ **Configuration**

### **Environment Variables**
```bash
# Enable enhanced console warnings in development
NODE_ENV=development

# Disable console warnings in production (logs still work)
NODE_ENV=production
```

### **Agent Configuration**
```typescript
// Disable AI planning to test fallback warnings
const agent = new EmailAgent({
  aiPlanning: {
    enableAIPlanning: false  // Will trigger fallback warning
  }
});
```

## 🚀 **Benefits**

1. **🔍 Visibility**: Never miss when fallbacks occur
2. **📈 Monitoring**: Easy integration with monitoring systems
3. **🐛 Debugging**: Clear context for troubleshooting
4. **⚡ Performance**: Identify performance bottlenecks
5. **🛡️ Reliability**: Proactive issue detection

## 🔧 **Troubleshooting**

### **Common Fallback Scenarios**

| Scenario | Warning | Action |
|----------|---------|--------|
| OpenAI API key missing | `🚨 CRITICAL FALLBACK` | Add API key to environment |
| Gmail service down | `⚠️ HIGH PRIORITY FALLBACK` | Check Gmail API status |
| AI planning timeout | `⚡ MEDIUM FALLBACK` | Increase timeout or optimize query |
| Agent not found | `🚨 CRITICAL FALLBACK` | Check agent registration |

### **Reducing Fallbacks**

1. **Ensure all services are properly configured**
2. **Set appropriate timeout values**
3. **Use suitable queries for AI planning**
4. **Monitor service health**
5. **Keep agents enabled and registered**

---

**🎉 You now have complete visibility into when and why fallbacks occur!**
