#!/usr/bin/env node

/**
 * Natural Language Logging Viewer
 * Filters and displays only natural language processing logs
 */

const fs = require('fs');
const path = require('path');

function viewNaturalLanguageLogs(options = {}) {
  const {
    sessionId = null,
    logLevel = null,
    tail = false,
    follow = false,
    lines = 50
  } = options;

  const logsDir = path.join(__dirname, 'logs');

  try {
    if (!fs.existsSync(logsDir)) {
      console.log('📂 No logs directory found. Natural language logging may not be enabled.');
      console.log('   Set NATURAL_LANGUAGE_LOGGING=true in your .env file');
      return;
    }

    // Get the latest natural language log file
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.startsWith('natural-language-'))
      .sort()
      .reverse();

    if (logFiles.length === 0) {
      console.log('📝 No natural language log files found.');
      console.log('   Make sure natural language logging is enabled and you have processed some requests.');
      return;
    }

    const latestLogFile = path.join(logsDir, logFiles[0]);
    console.log(`📖 Reading natural language logs from: ${logFiles[0]}\\n`);

    // Read and parse the log file
    const logContent = fs.readFileSync(latestLogFile, 'utf8');
    const logLines = logContent.trim().split('\\n').filter(line => line.trim());

    if (tail) {
      // Show only the last N lines
      logLines.splice(0, Math.max(0, logLines.length - lines));
    }

    const naturalLanguageEntries = [];

    for (const line of logLines) {
      try {
        const entry = JSON.parse(line);

        // Filter for natural language types
        if (entry.type && ['intent_analysis', 'plan_creation', 'string_plan_creation', 'agent_communication', 'draft_workflow', 'natural_language_flow'].includes(entry.type)) {

          // Apply session filter if specified
          if (sessionId && entry.sessionId !== sessionId) {
            continue;
          }

          // Apply log level filter if specified
          if (logLevel && entry.level !== logLevel) {
            continue;
          }

          naturalLanguageEntries.push(entry);
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }

    if (naturalLanguageEntries.length === 0) {
      console.log('🔍 No natural language processing entries found.');
      console.log('   Try processing some requests or check if logging is properly configured.');
      return;
    }

    console.log(`🧠 Found ${naturalLanguageEntries.length} natural language processing entries\\n`);

    // Group by session and display
    const sessionGroups = {};
    for (const entry of naturalLanguageEntries) {
      const session = entry.sessionId || 'unknown';
      if (!sessionGroups[session]) {
        sessionGroups[session] = [];
      }
      sessionGroups[session].push(entry);
    }

    for (const [session, entries] of Object.entries(sessionGroups)) {
      console.log(`🔗 Session: ${session}`);
      console.log('═'.repeat(60));

      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      for (const entry of entries) {
        const time = new Date(entry.timestamp).toLocaleTimeString();

        switch (entry.type) {
          case 'intent_analysis':
            console.log(`\\n📋 [${time}] INTENT ANALYSIS`);
            console.log(`   User Input: ${entry.userInput}`);
            console.log(`   Intent Type: ${entry.intent?.intentType} (${(entry.intent?.confidence * 100).toFixed(1)}%)`);
            console.log(`   Reasoning: ${entry.intent?.reasoning}`);
            if (entry.intent?.targetDraftId) {
              console.log(`   Target Draft: ${entry.intent.targetDraftId}`);
            }
            break;

          case 'plan_creation':
            console.log(`\\n🗺️  [${time}] PLAN CREATION (Legacy)`);
            console.log(`   Step ${entry.plan?.stepNumber}: ${entry.plan?.description}`);
            console.log(`   Agent: ${entry.plan?.agent}`);
            console.log(`   Operation: ${entry.plan?.operation}`);
            console.log(`   Natural Language Request: ${entry.plan?.naturalLanguageRequest}`);
            console.log(`   Reasoning: ${entry.plan?.reasoning}`);
            break;

          case 'string_plan_creation':
            console.log(`\\n🎯 [${time}] STRING PLAN CREATION`);
            console.log(`   Step ${entry.plan?.stepNumber}: ${entry.plan?.stepDescription}`);
            console.log(`   Plan Type: ${entry.plan?.planType}`);
            console.log(`   Is Complete: ${entry.plan?.isComplete}`);
            console.log(`   Reasoning: ${entry.plan?.reasoning}`);
            break;

          case 'agent_communication':
            console.log(`\\n🤖 [${time}] AGENT: ${entry.agent}`);
            console.log(`   Request: ${entry.request}`);
            console.log(`   Response: ${entry.response?.response}`);
            if (entry.response?.hasDraft) {
              console.log(`   📄 Draft Created: ${entry.response.draftType} (${entry.response.draftId})`);
            }
            if (entry.response?.warnings?.length) {
              console.log(`   ⚠️  Warnings: ${entry.response.warnings.join(', ')}`);
            }
            break;

          case 'draft_workflow':
            const draftIcon = entry.action === 'created' ? '📝' : entry.action === 'executed' ? '✅' : entry.action === 'cancelled' ? '❌' : '📄';
            console.log(`\\n${draftIcon} [${time}] DRAFT ${entry.action.toUpperCase()}`);
            console.log(`   Draft ID: ${entry.draftId}`);
            console.log(`   Draft Type: ${entry.draftType}`);
            if (entry.details) {
              console.log(`   Details: ${entry.details}`);
            }
            break;

          case 'natural_language_flow':
            console.log(`\\n🌊 [${time}] COMPLETE FLOW`);
            console.log(`   User Input: ${entry.flow?.userInput}`);
            console.log(`   Final Response: ${entry.flow?.finalResponse?.substring(0, 200)}...`);
            if (entry.flow?.executionTime) {
              console.log(`   Execution Time: ${entry.flow.executionTime}ms`);
            }
            break;
        }
      }
      console.log('\\n' + '─'.repeat(60) + '\\n');
    }

  } catch (error) {
    console.error('❌ Error reading natural language logs:', error.message);
  }
}

// CLI interface
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--session':
      options.sessionId = args[++i];
      break;
    case '--level':
      options.logLevel = args[++i];
      break;
    case '--tail':
      options.tail = true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        options.lines = parseInt(args[++i]);
      }
      break;
    case '--follow':
      options.follow = true;
      break;
    case '--help':
      console.log(`
🧠 Natural Language Logging Viewer

Usage: node view-natural-language-logs.js [options]

Options:
  --session <sessionId>    Filter by session ID
  --level <level>          Filter by log level (intent, plan, agent, draft, flow)
  --tail [lines]           Show only last N lines (default: 50)
  --follow                 Follow log file for new entries (not implemented)
  --help                   Show this help message

Examples:
  node view-natural-language-logs.js
  node view-natural-language-logs.js --session test-session-123
  node view-natural-language-logs.js --level agent --tail 20
      `);
      process.exit(0);
  }
}

if (options.follow) {
  console.log('📡 Following natural language logs... (Press Ctrl+C to stop)');
  // TODO: Implement log following
  console.log('   (Log following not yet implemented)');
} else {
  viewNaturalLanguageLogs(options);
}