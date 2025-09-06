// Simple diagnostic script to test preview functionality
const { AgentFactory } = require('./dist/framework/agent-factory');

console.log('🔍 Debugging Preview/Confirmation Flow...\n');

try {
  // Initialize AgentFactory
  console.log('1. Initializing AgentFactory...');
  AgentFactory.initialize();
  
  // Check AgentFactory stats
  const stats = AgentFactory.getStats();
  console.log('2. AgentFactory Stats:', {
    totalAgents: stats.totalAgents,
    enabledAgents: stats.enabledAgents,
    totalTools: stats.totalTools,
    confirmationTools: stats.confirmationTools,
    toolNames: stats.toolNames
  });
  
  // Test emailAgent confirmation requirement
  console.log('\n3. Testing emailAgent confirmation requirement:');
  const emailNeedsConfirmation = AgentFactory.toolNeedsConfirmation('emailAgent');
  console.log(`   emailAgent requires confirmation: ${emailNeedsConfirmation}`);
  
  // Test calendarAgent confirmation requirement  
  console.log('4. Testing calendarAgent confirmation requirement:');
  const calendarNeedsConfirmation = AgentFactory.toolNeedsConfirmation('calendarAgent');
  console.log(`   calendarAgent requires confirmation: ${calendarNeedsConfirmation}`);
  
  // Test thinkAgent confirmation requirement (should be false)
  console.log('5. Testing thinkAgent confirmation requirement:');
  const thinkNeedsConfirmation = AgentFactory.toolNeedsConfirmation('Think');
  console.log(`   Think requires confirmation: ${thinkNeedsConfirmation}`);
  
  // Check if agents have executePreview method
  console.log('\n6. Checking for executePreview method:');
  const emailAgent = AgentFactory.getAgent('emailAgent');
  const calendarAgent = AgentFactory.getAgent('calendarAgent');
  
  console.log(`   emailAgent has executePreview: ${emailAgent && typeof emailAgent.executePreview === 'function'}`);
  console.log(`   calendarAgent has executePreview: ${calendarAgent && typeof calendarAgent.executePreview === 'function'}`);
  
  console.log('\n✅ Diagnostic completed successfully!');
  
} catch (error) {
  console.error('❌ Diagnostic failed:', error);
}
