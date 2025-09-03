# PostgreSQL Integration for Persistent Slack Authentication

This document explains how to set up PostgreSQL integration to solve the Slack bot authentication persistence issue.

## 🎯 Problem Solved

**Issue**: Slack bot forgets authentication shortly after login
**Solution**: Persistent PostgreSQL storage for sessions and OAuth tokens

## 🚀 Quick Setup

### 1. Set up your Railway PostgreSQL database

1. Go to your Railway dashboard
2. Create a new PostgreSQL database
3. Copy the connection string (DATABASE_URL)

### 2. Configure environment variables

Add to your `.env` file:
```bash
# PostgreSQL Database (Railway)
DATABASE_URL=postgresql://username:password@host:5432/database
```

### 3. Set up the database schema

```bash
cd backend
npm run db:setup
```

### 4. Test the integration

```bash
npm run db:integration
```

### 5. Restart your application

```bash
npm run dev
```

## 🏗️ Architecture Overview

### Before (In-Memory Storage)
```
Slack Event → SessionService (Map<string, SessionContext>) → Lost on restart
```

### After (PostgreSQL Storage)
```
Slack Event → SessionService → DatabaseService → PostgreSQL → Persistent across restarts
```

## 📊 Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  conversation_history JSONB DEFAULT '[]',
  tool_calls JSONB DEFAULT '[]',
  tool_results JSONB DEFAULT '[]',
  slack_context JSONB
);
```

### OAuth Tokens Table
```sql
CREATE TABLE oauth_tokens (
  session_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
```

### Slack Workspaces Table
```sql
CREATE TABLE slack_workspaces (
  team_id VARCHAR(255) PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  bot_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Slack Users Table
```sql
CREATE TABLE slack_users (
  slack_user_id VARCHAR(255),
  team_id VARCHAR(255) NOT NULL,
  google_user_id VARCHAR(255),
  access_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slack_user_id, team_id),
  FOREIGN KEY (team_id) REFERENCES slack_workspaces(team_id) ON DELETE CASCADE
);
```

## 🔧 Implementation Details

### DatabaseService
- **Location**: `src/services/database.service.ts`
- **Purpose**: Handles all PostgreSQL operations
- **Features**: Connection pooling, schema initialization, CRUD operations

### SessionService Updates
- **Location**: `src/services/session.service.ts`
- **Changes**: Now uses DatabaseService for persistent storage
- **Fallback**: Maintains in-memory storage if database unavailable

### Service Registration
- **Location**: `src/services/service-initialization.ts`
- **Order**: DatabaseService (priority 5) → SessionService (priority 10)

## 🧪 Testing

### Setup Test
```bash
npm run db:setup
```
Tests database connection and creates schema.

### Integration Test
```bash
npm run db:integration
```
Tests full integration including session and OAuth token persistence.

### Manual Testing
1. Start your application
2. Authenticate with Slack
3. Send a message to your bot
4. Restart the application
5. Send another message - authentication should persist

## 🔍 Troubleshooting

### Connection Issues
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Test connection manually
npm run db:test
```

### Schema Issues
```bash
# Recreate schema
npm run db:setup
```

### Performance Issues
- Check database connection pool settings
- Monitor query performance
- Consider adding more indexes

## 📈 Benefits

### ✅ Persistent Authentication
- OAuth tokens survive server restarts
- Sessions maintain context across deployments
- No more re-authentication required

### ✅ Scalability
- Database can handle multiple workspaces
- Concurrent user support
- Horizontal scaling ready

### ✅ Reliability
- Automatic cleanup of expired sessions
- Foreign key constraints for data integrity
- Transaction support for consistency

### ✅ Monitoring
- Session statistics and metrics
- OAuth token expiration tracking
- Database health monitoring

## 🔄 Migration from In-Memory

The system automatically migrates from in-memory to PostgreSQL:

1. **First run**: Creates database schema
2. **Session creation**: Stores in PostgreSQL
3. **Token storage**: Persists OAuth tokens
4. **Fallback**: In-memory storage if database unavailable

## 🚀 Production Deployment

### Railway Deployment
1. Add DATABASE_URL to Railway environment variables
2. Deploy your application
3. Run database setup: `npm run db:setup`
4. Verify integration: `npm run db:integration`

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://username:password@host:5432/database

# Optional (for advanced configuration)
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

## 📚 Related Files

- `src/services/database.service.ts` - PostgreSQL service
- `src/services/session.service.ts` - Updated session management
- `src/services/service-initialization.ts` - Service registration
- `scripts/setup-database.ts` - Database setup script
- `scripts/test-database-integration.ts` - Integration tests

## 🎉 Success Criteria

Your PostgreSQL integration is working when:

1. ✅ Database setup completes without errors
2. ✅ Integration tests pass
3. ✅ Slack authentication persists across restarts
4. ✅ OAuth tokens are stored in PostgreSQL
5. ✅ Sessions maintain context between interactions

---

**Next Steps**: After setting up PostgreSQL, your Slack bot will maintain authentication persistently, solving the original issue of forgotten authentication.
