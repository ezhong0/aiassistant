#!/usr/bin/env node

import * as readline from 'readline';
import { MasterAgent } from './agents/master.agent';
import logger from './utils/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class MasterAgentCLI {
  private masterAgent: MasterAgent;
  private sessionId: string;
  private rl: readline.Interface;

  constructor() {
    // Initialize with OpenAI if available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (openaiApiKey) {
      this.masterAgent = new MasterAgent({
        openaiApiKey,
        model: 'gpt-4o-mini'
      });
      console.log(`${colors.green}✅ Master Agent initialized with OpenAI integration${colors.reset}`);
    } else {
      this.masterAgent = new MasterAgent();
      console.log(`${colors.yellow}⚠️  Master Agent initialized with rule-based routing only${colors.reset}`);
      console.log(`${colors.dim}   (Add OPENAI_API_KEY to .env for AI-powered routing)${colors.reset}`);
    }

    this.sessionId = `cli-session-${Date.now()}`;
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.blue}📝 You: ${colors.reset}`
    });

    console.log(`${colors.cyan}🤖 Master Agent CLI${colors.reset}`);
    console.log(`${colors.dim}Session ID: ${this.sessionId}${colors.reset}\n`);
  }

  start() {
    this.showHelp();
    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // Handle special commands
      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        console.log(`${colors.yellow}👋 Goodbye!${colors.reset}`);
        this.rl.close();
        return;
      }

      if (trimmedInput.toLowerCase() === 'help') {
        this.showHelp();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'clear') {
        console.clear();
        this.showBanner();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'newsession') {
        this.sessionId = `cli-session-${Date.now()}`;
        console.log(`${colors.green}🔄 Started new session: ${this.sessionId}${colors.reset}\n`);
        this.rl.prompt();
        return;
      }

      // Process user input with master agent
      await this.processInput(trimmedInput);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(`${colors.yellow}Session ended. Thanks for testing the Master Agent!${colors.reset}`);
      process.exit(0);
    });
  }

  private async processInput(input: string) {
    console.log(`\n${colors.magenta}🧠 Master Agent is thinking...${colors.reset}`);
    
    const startTime = Date.now();
    
    try {
      const response = await this.masterAgent.processUserInput(input, this.sessionId);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`${colors.green}🤖 Agent Response:${colors.reset} ${response.message}`);
      console.log(`${colors.dim}⏱️  Processing time: ${duration}ms${colors.reset}`);
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`\n${colors.cyan}🛠️  Tool Execution Plan:${colors.reset}`);
        
        response.toolCalls.forEach((toolCall, index) => {
          const icon = this.getToolIcon(toolCall.name);
          const step = index + 1;
          
          console.log(`${colors.white}${step}.${colors.reset} ${icon} ${colors.bright}${toolCall.name}${colors.reset}`);
          
          // Show parameters in a nice format
          if (toolCall.parameters && Object.keys(toolCall.parameters).length > 0) {
            Object.entries(toolCall.parameters).forEach(([key, value]) => {
              const displayValue = typeof value === 'string' && value.length > 50 
                ? value.substring(0, 50) + '...' 
                : value;
              console.log(`   ${colors.dim}${key}: ${displayValue}${colors.reset}`);
            });
          }
        });
        
        // Show the execution flow
        console.log(`\n${colors.yellow}📋 Execution Flow:${colors.reset}`);
        const flowText = response.toolCalls.map(tc => tc.name).join(' → ');
        console.log(`   ${colors.bright}${flowText}${colors.reset}`);
        
        // Highlight contact lookup logic
        const hasContactAgent = response.toolCalls.some(tc => tc.name === 'contactAgent');
        const hasEmailOrCalendar = response.toolCalls.some(tc => 
          tc.name === 'emailAgent' || tc.name === 'calendarAgent'
        );
        const hasThink = response.toolCalls.some(tc => tc.name === 'Think');
        
        if (hasContactAgent && hasEmailOrCalendar) {
          console.log(`   ${colors.green}✅ Contact lookup → Action (following the rules!)${colors.reset}`);
        }
        
        if (hasThink) {
          console.log(`   ${colors.green}✅ Think tool included for verification${colors.reset}`);
        }
      }
      
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    }
    
    console.log(); // Add spacing
  }

  private getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
      'Think': '🤔',
      'emailAgent': '📧',
      'calendarAgent': '📅',
      'contactAgent': '👤',
      'contentCreator': '✍️',
      'Tavily': '🔍'
    };
    return icons[toolName] || '🛠️';
  }

  private showBanner() {
    console.log(`${colors.cyan}╔═══════════════════════════════════════╗`);
    console.log(`║           🤖 Master Agent CLI          ║`);
    console.log(`║      Test your routing logic here!     ║`);
    console.log(`╚═══════════════════════════════════════╝${colors.reset}\n`);
  }

  private showHelp() {
    this.showBanner();
    
    console.log(`${colors.bright}Commands:${colors.reset}`);
    console.log(`  ${colors.green}help${colors.reset}       - Show this help message`);
    console.log(`  ${colors.green}clear${colors.reset}      - Clear the screen`);
    console.log(`  ${colors.green}newsession${colors.reset} - Start a new conversation session`);
    console.log(`  ${colors.green}exit/quit${colors.reset}  - Exit the CLI\n`);
    
    console.log(`${colors.bright}Example queries to try:${colors.reset}`);
    console.log(`  ${colors.dim}• "send an email to john asking about the meeting"`);
    console.log(`  • "schedule a call with sarah tomorrow at 3pm"`);
    console.log(`  • "create a blog post about AI"`);
    console.log(`  • "search for latest news about OpenAI"`);
    console.log(`  • "find contact info for Dr. Smith"`);
    console.log(`  • "schedule a personal reminder for 9am"${colors.reset}\n`);
    
    console.log(`${colors.bright}Watch for:${colors.reset}`);
    console.log(`  ${colors.yellow}🔍 Contact lookup before email/calendar actions`);
    console.log(`  🤔 Think tool always called for verification`);
    console.log(`  📋 Smart routing based on your exact rules${colors.reset}\n`);
  }
}

// Create and start the CLI
const cli = new MasterAgentCLI();
cli.start();