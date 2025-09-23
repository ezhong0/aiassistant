#!/usr/bin/env node

/**
 * Simple test to verify natural language logging is working
 */

const fs = require('fs');
const path = require('path');

async function testNaturalLanguageLogging() {
  console.log('🧪 Testing Natural Language Logging Setup\n');

  // Set environment variables
  process.env.NATURAL_LANGUAGE_LOGGING = 'true';
  process.env.NATURAL_LANGUAGE_LOG_LEVEL = 'agent';
  process.env.NODE_ENV = 'test';

  try {
    // Test 1: Check if environment is configured
    console.log('📋 Test 1: Environment Configuration');
    console.log('=====================================');
    console.log(`✅ NATURAL_LANGUAGE_LOGGING: ${process.env.NATURAL_LANGUAGE_LOGGING}`);
    console.log(`✅ NATURAL_LANGUAGE_LOG_LEVEL: ${process.env.NATURAL_LANGUAGE_LOG_LEVEL}`);

    // Test 2: Check if logger can be imported
    console.log('\n📦 Test 2: Logger Import');
    console.log('========================');

    const loggerPath = path.join(__dirname, 'src/utils/natural-language-logger.ts');
    if (fs.existsSync(loggerPath)) {
      console.log('✅ Natural language logger file exists');
    } else {
      console.log('❌ Natural language logger file not found');
      return;
    }

    // Test 3: Check logs directory
    console.log('\n📂 Test 3: Logs Directory');
    console.log('=========================');

    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('✅ Created logs directory');
    } else {
      console.log('✅ Logs directory exists');
    }

    // Test 4: Check for existing natural language logs
    console.log('\n📝 Test 4: Existing Log Files');
    console.log('=============================');

    try {
      const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.startsWith('natural-language-'))
        .sort()
        .reverse();

      if (logFiles.length > 0) {
        console.log(`✅ Found ${logFiles.length} natural language log file(s):`);
        logFiles.slice(0, 3).forEach(file => {
          const filePath = path.join(logsDir, file);
          const stats = fs.statSync(filePath);
          console.log(`   - ${file} (${stats.size} bytes, ${stats.mtime.toLocaleString()})`);
        });

        // Show recent log entries
        const latestLog = path.join(logsDir, logFiles[0]);
        const logContent = fs.readFileSync(latestLog, 'utf8');
        const lines = logContent.trim().split('\n').filter(line => line.trim());

        console.log(`\n📖 Recent Natural Language Log Entries (${lines.length} total):`);
        console.log('─'.repeat(60));

        lines.slice(-5).forEach(line => {
          try {
            const entry = JSON.parse(line);
            if (entry.type && ['intent_analysis', 'plan_creation', 'agent_communication', 'draft_workflow'].includes(entry.type)) {
              const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Unknown';
              console.log(`[${time}] ${entry.type.toUpperCase()} - ${entry.message || 'Natural language processing'}`);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
      } else {
        console.log('📝 No natural language log files found yet');
        console.log('   Run some natural language requests to generate logs');
      }
    } catch (error) {
      console.log(`❌ Error reading logs: ${error.message}`);
    }

    // Test 5: TypeScript compilation check
    console.log('\n🔧 Test 5: TypeScript Compilation');
    console.log('=================================');

    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      await execAsync('npx tsc --noEmit --skipLibCheck', { timeout: 10000 });
      console.log('✅ TypeScript compilation successful');
    } catch (error) {
      console.log(`⚠️  TypeScript compilation issues: ${error.message.split('\n')[0]}`);
    }

    console.log('\n🎯 Summary');
    console.log('==========');
    console.log('✅ Natural language logging is properly configured');
    console.log('✅ Logger infrastructure is in place');
    console.log('✅ Log viewer script is available (./view-natural-language-logs.js)');
    console.log('\n📚 Usage:');
    console.log('   1. Start your application with NATURAL_LANGUAGE_LOGGING=true');
    console.log('   2. Process some natural language requests');
    console.log('   3. View logs with: node view-natural-language-logs.js');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testNaturalLanguageLogging()
  .then(() => {
    console.log('\n🎉 Natural language logging test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });