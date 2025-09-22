import { BaseService } from './base-service';
import { MasterAgent } from '../agents/master.agent';
import { createMasterAgent } from '../config/agent-factory-init';

export class MasterAgentService extends BaseService {
  private instance: MasterAgent | null = null;

  constructor() {
    super('masterAgentService');
  }

  protected async onInitialize(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    this.instance = apiKey ? createMasterAgent({ openaiApiKey: apiKey, model: 'gpt-4o-mini' }) : createMasterAgent();
  }

  getMasterAgent(): MasterAgent | null {
    return this.instance;
  }

  protected async onDestroy(): Promise<void> {
    this.instance = null;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return { healthy: !!this.instance };
  }
}


