#!/usr/bin/env node

/**
 * Demo script for the AI Configuration System
 * Shows hot-reload functionality and configuration usage
 */

const { AIConfigManager } = require('./src/framework/ai-config');
const path = require('path');

console.log('🚀 AI Configuration System Demo\n');

// Create config manager instance
const configPath = path.join(__dirname, 'config/ai-config.yaml');
const configManager = new AIConfigManager(configPath);

console.log('📋 Available OpenAI Configurations:');
const openaiConfigs = configManager.getAvailableConfigs().openai;
openaiConfigs.forEach(configName => {
  try {
    const config = configManager.getOpenAIConfig(configName);
    console.log(`  ${configName}: ${config.model} (temp: ${config.temperature}, tokens: ${config.max_tokens})`);
  } catch (error) {
    console.log(`  ${configName}: ❌ ${error.message}`);
  }
});

console.log('\n📝 Available Prompt Templates:');
const prompts = configManager.getAvailablePrompts();
prompts.forEach(promptName => {
  console.log(`  ${promptName}`);
});

console.log('\n🤖 Available Agent Configurations:');
const agents = configManager.getAvailableConfigs().agents;
agents.forEach(agentName => {
  try {
    const config = configManager.getAgentConfig(agentName);
    console.log(`  ${agentName}: ${config.timeout}ms timeout, ${config.retries} retries, ${config.fallback_strategy} strategy`);
  } catch (error) {
    console.log(`  ${agentName}: ❌ ${error.message}`);
  }
});

console.log('\n🔧 Testing Prompt Template Rendering:');
try {
  const emailPrompt = configManager.getPrompt('email_extraction', {
    userInput: 'Send email to john@example.com about the project meeting'
  });
  console.log('Email extraction prompt:');
  console.log(emailPrompt.substring(0, 100) + '...');
} catch (error) {
  console.log('❌ Error rendering prompt:', error.message);
}

console.log('\n⚡ Hot Reload Demo:');
console.log('1. The configuration is loaded from:', configPath);
console.log('2. In development mode, file changes will automatically reload');
console.log('3. Try editing the YAML file and watch for the reload message');
console.log('4. No code restart required!');

console.log('\n✅ Demo completed successfully!');
console.log('\n💡 To test hot reload:');
console.log('   - Edit config/ai-config.yaml');
console.log('   - Watch for "🔄 AI configuration reloaded" message');
console.log('   - Changes take effect immediately');
