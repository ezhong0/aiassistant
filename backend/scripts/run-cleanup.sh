#!/bin/bash

# Database and Redis Cleanup Script
# Automates the entire cleanup process with safety checks

set -e  # Exit on error

echo "🧹 Database and Redis Cleanup Script"
echo "====================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set your database URL:"
    echo "export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

# Check if REDIS_URL is set
if [ -z "$REDIS_URL" ]; then
    echo -e "${YELLOW}⚠️  Warning: REDIS_URL not set, using default redis://localhost:6379${NC}"
    export REDIS_URL="redis://localhost:6379"
fi

echo "📊 Current Configuration:"
echo "  Database: ${DATABASE_URL%%@*}@***"
echo "  Redis: ${REDIS_URL}"
echo ""

# Step 1: Check database connection
echo "1️⃣  Checking database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Database connection successful${NC}"
else
    echo -e "  ${RED}✗ Cannot connect to database${NC}"
    exit 1
fi

# Step 2: Show current table count
echo ""
echo "2️⃣  Current database state:"
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  Tables: $TABLE_COUNT"

# Show tables
echo ""
echo "  Current tables:"
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Step 3: Check for data in user_tokens
echo ""
echo "3️⃣  Checking user_tokens data:"
USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_tokens;" 2>/dev/null || echo "0")
echo "  Users with tokens: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
    echo ""
    echo "  Sample data (first 3 users):"
    psql "$DATABASE_URL" -c "SELECT user_id, google_access_token IS NOT NULL as has_google, slack_access_token IS NOT NULL as has_slack, created_at FROM user_tokens LIMIT 3;"
fi

# Step 4: Confirm before proceeding
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will drop unused tables and clean Redis${NC}"
echo ""
echo "The following will happen:"
echo "  1. Backup tables will be created automatically"
echo "  2. Unused tables will be dropped (oauth_tokens, sessions, slack_users, etc.)"
echo "  3. user_tokens will be recreated with optimized schema"
echo "  4. Your user token data will be preserved"
echo "  5. Redis will be cleaned of stale keys"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Step 5: Create full database backup
echo ""
echo "4️⃣  Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo -e "  ${GREEN}✓ Backup created: $BACKUP_FILE${NC}"

# Step 6: Run migration
echo ""
echo "5️⃣  Running database migration..."
psql "$DATABASE_URL" -f migrations/006_cleanup_unused_tables.sql

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Migration completed successfully${NC}"
else
    echo -e "  ${RED}✗ Migration failed${NC}"
    echo ""
    echo "You can restore from backup:"
    echo "  psql \$DATABASE_URL < $BACKUP_FILE"
    exit 1
fi

# Step 7: Verify migration
echo ""
echo "6️⃣  Verifying database state:"
NEW_TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
NEW_USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_tokens;")

echo "  Tables after cleanup: $NEW_TABLE_COUNT"
echo "  Users after cleanup: $NEW_USER_COUNT"

if [ "$USER_COUNT" -ne "$NEW_USER_COUNT" ]; then
    echo -e "  ${RED}⚠️  Warning: User count changed! ($USER_COUNT → $NEW_USER_COUNT)${NC}"
    echo "  Check backup table: SELECT * FROM _backup_user_tokens_20250930;"
else
    echo -e "  ${GREEN}✓ User data preserved${NC}"
fi

echo ""
echo "  Final tables:"
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Step 8: Clean Redis
echo ""
echo "7️⃣  Cleaning Redis..."
echo ""

# Check if Redis is accessible
if redis-cli -u "$REDIS_URL" PING > /dev/null 2>&1; then
    # Run Redis cleanup script
    npx ts-node scripts/cleanup-redis.ts

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ Redis cleanup completed${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Redis cleanup had issues (non-fatal)${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  Cannot connect to Redis, skipping cleanup${NC}"
fi

# Step 9: Summary
echo ""
echo "✅ Cleanup Complete!"
echo "===================="
echo ""
echo "📊 Summary:"
echo "  - Database backup: $BACKUP_FILE"
echo "  - Tables before: $TABLE_COUNT"
echo "  - Tables after: $NEW_TABLE_COUNT"
echo "  - User tokens: $NEW_USER_COUNT preserved"
echo ""
echo "🔍 What to do next:"
echo ""
echo "1. Test your application:"
echo "   npm run dev"
echo ""
echo "2. Test OAuth flows:"
echo "   - Google (Gmail, Calendar, Contacts)"
echo "   - Slack"
echo ""
echo "3. Test conversations:"
echo "   - Send message to Slack bot"
echo "   - Verify context is maintained"
echo ""
echo "4. After 24-48 hours, clean up backup tables:"
echo "   psql \$DATABASE_URL -c \"DROP TABLE IF EXISTS _backup_sessions_20250930, _backup_user_tokens_20250930;\""
echo ""
echo "📝 For more information:"
echo "   cat docs/DATABASE_CLEANUP_GUIDE.md"
echo ""