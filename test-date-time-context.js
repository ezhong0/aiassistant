const { MasterAgent } = require('./backend/dist/agents/master.agent.js');

/**
 * Test script to verify enhanced date/time context in system prompt
 */
async function testDateTimeContext() {
  console.log('🧪 Testing Enhanced Date/Time Context...\n');
  
  try {
    // Create master agent instance
    const agent = new MasterAgent({
      openaiApiKey: 'test-key' // Mock key to enable system prompt generation
    });
    
    console.log('✅ Master agent created successfully');
    
    // Get the system prompt to verify date/time context
    const systemPrompt = agent.getSystemPrompt();
    
    console.log('\n📋 System Prompt Date/Time Context:');
    console.log('=====================================');
    
    // Extract and display the current context section
    const contextMatch = systemPrompt.match(/## Current Context[\s\S]*?(?=## Time and Date Guidelines|$)/);
    if (contextMatch) {
      console.log(contextMatch[0]);
    } else {
      console.log('❌ Current Context section not found');
    }
    
    // Extract and display the time guidelines section
    const guidelinesMatch = systemPrompt.match(/## Time and Date Guidelines[\s\S]*?(?=##|$)/);
    if (guidelinesMatch) {
      console.log(guidelinesMatch[0]);
    } else {
      console.log('❌ Time and Date Guidelines section not found');
    }
    
    // Verify key information is present
    const checks = [
      { name: 'ISO DateTime', regex: /Current date\/time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
      { name: 'Human-readable date', regex: /Today is: \w+, \w+ \d{1,2}, \d{4}/ },
      { name: 'Current time with timezone', regex: /Current time: \d{1,2}:\d{2}:\d{2} (AM|PM) [A-Z]{3,4}/ },
      { name: 'Timezone info', regex: /Current timezone: [A-Za-z_\/]+/ },
      { name: 'Today/tomorrow reference', regex: /When users ask about "today", "tomorrow"/ },
      { name: 'Explicit dates guidance', regex: /always specify explicit dates and times/ },
      { name: 'Chronological order', regex: /show them in chronological order/ }
    ];
    
    console.log('\n🔍 Context Validation:');
    console.log('=====================');
    
    let passedChecks = 0;
    checks.forEach(check => {
      const passed = check.regex.test(systemPrompt);
      console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
      if (passed) passedChecks++;
    });
    
    console.log(`\n📊 Results: ${passedChecks}/${checks.length} checks passed`);
    
    if (passedChecks === checks.length) {
      console.log('\n🎉 SUCCESS: Enhanced date/time context is properly configured!');
      console.log('\nThe master agent now provides:');
      console.log('• Current date/time in ISO format for precise reference');
      console.log('• Human-readable date for natural understanding');
      console.log('• Current time with timezone information');
      console.log('• Clear guidelines for handling relative time references');
      console.log('• Instructions for chronological event ordering');
    } else {
      console.log('\n❌ PARTIAL: Some date/time context elements are missing');
    }
    
    return passedChecks === checks.length;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDateTimeContext().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testDateTimeContext };