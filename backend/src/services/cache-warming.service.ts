/**
 * Cache Warming Service
 * Proactively loads frequently accessed data into cache to improve response times
 *
 * Warming Strategies:
 * - User-based: Preload common data for active users
 * - Time-based: Warm cache before peak hours
 * - Pattern-based: Preload data based on usage patterns
 * - Event-driven: Warm related cache after certain events
 *
 * Features:
 * - Intelligent preloading based on user behavior
 * - Background warming without affecting user operations
 * - Cache efficiency optimization
 * - Warming schedule management
 */

import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { GmailCacheService } from './email/gmail-cache.service';
import { ContactCacheService } from './contact/contact-cache.service';
import { SlackCacheService } from './slack/slack-cache.service';
import { CalendarCacheService } from './calendar/calendar-cache.service';
import { TokenStorageService } from './token-storage.service';
import { ServiceManager } from './service-manager';

export enum WarmingStrategy {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
  PATTERN_BASED = 'pattern_based',
  EVENT_DRIVEN = 'event_driven'
}

export enum WarmingPriority {
  HIGH = 1,      // Critical data (upcoming meetings, recent emails)
  MEDIUM = 2,    // Important data (frequently accessed contacts)
  LOW = 3        // Nice-to-have data (old calendar events)
}

export interface WarmingTask {
  id: string;
  userId: string;
  dataType: string;
  strategy: WarmingStrategy;
  priority: WarmingPriority;
  parameters: Record<string, any>;
  scheduledTime?: Date;
  executedTime?: Date;
  success?: boolean;
  executionTime?: number;
  retryCount: number;
  maxRetries: number;
}

export interface WarmingRule {
  id: string;
  name: string;
  condition: string; // e.g., "user_login", "business_hours_start"
  dataTypes: string[];
  strategy: WarmingStrategy;
  priority: WarmingPriority;
  enabled: boolean;
  parameters: Record<string, any>;
}

export interface WarmingMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  cacheHitImprovement: number;
  lastWarmingRun: Date | null;
  warmingByPriority: Record<WarmingPriority, number>;
  warmingByDataType: Record<string, number>;
}

export interface UserActivity {
  userId: string;
  lastLogin: Date;
  activeHours: number[];
  frequentDataTypes: string[];
  averageSessionDuration: number;
  commonOperations: string[];
}

export class CacheWarmingService extends BaseService {
  private cacheService: CacheService | null = null;
  private gmailCacheService: GmailCacheService | null = null;
  private contactCacheService: ContactCacheService | null = null;
  private slackCacheService: SlackCacheService | null = null;
  private calendarCacheService: CalendarCacheService | null = null;
  private tokenStorageService: TokenStorageService | null = null;

  private warmingTasks: Map<string, WarmingTask> = new Map();
  private userActivities: Map<string, UserActivity> = new Map();

  private metrics: WarmingMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    cacheHitImprovement: 0,
    lastWarmingRun: null,
    warmingByPriority: {
      [WarmingPriority.HIGH]: 0,
      [WarmingPriority.MEDIUM]: 0,
      [WarmingPriority.LOW]: 0
    },
    warmingByDataType: {}
  };

  // Predefined warming rules
  private readonly warmingRules: WarmingRule[] = [
    {
      id: 'user_login_immediate',
      name: 'Immediate warming on user login',
      condition: 'user_login',
      dataTypes: ['upcoming_meetings', 'recent_emails', 'frequent_contacts'],
      strategy: WarmingStrategy.IMMEDIATE,
      priority: WarmingPriority.HIGH,
      enabled: true,
      parameters: {
        timeRange: '24h',
        maxItems: 20
      }
    },
    {
      id: 'business_hours_scheduled',
      name: 'Scheduled warming before business hours',
      condition: 'business_hours_start',
      dataTypes: ['calendar_today', 'email_search_common', 'contact_frequent'],
      strategy: WarmingStrategy.SCHEDULED,
      priority: WarmingPriority.MEDIUM,
      enabled: true,
      parameters: {
        scheduleTime: '08:00',
        timeRange: '8h'
      }
    },
    {
      id: 'pattern_based_weekly',
      name: 'Pattern-based warming for frequent data',
      condition: 'pattern_detected',
      dataTypes: ['calendar_patterns', 'email_patterns', 'contact_patterns'],
      strategy: WarmingStrategy.PATTERN_BASED,
      priority: WarmingPriority.LOW,
      enabled: true,
      parameters: {
        lookbackDays: 7,
        minFrequency: 3
      }
    },
    {
      id: 'meeting_event_driven',
      name: 'Event-driven warming for meeting participants',
      condition: 'meeting_scheduled',
      dataTypes: ['attendee_contacts', 'meeting_history', 'related_emails'],
      strategy: WarmingStrategy.EVENT_DRIVEN,
      priority: WarmingPriority.HIGH,
      enabled: true,
      parameters: {
        preloadMinutes: 30
      }
    }
  ];

  // Warming interval (5 minutes)
  private warmingInterval: NodeJS.Timeout | null = null;
  private readonly WARMING_INTERVAL_MS = 5 * 60 * 1000;

  constructor() {
    super('CacheWarmingService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Cache Warming Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
      this.gmailCacheService = serviceManager.getService<GmailCacheService>('gmailCacheService') || null;
      this.contactCacheService = serviceManager.getService<ContactCacheService>('contactCacheService') || null;
      this.slackCacheService = serviceManager.getService<SlackCacheService>('slackCacheService') || null;
      this.calendarCacheService = serviceManager.getService<CalendarCacheService>('calendarCacheService') || null;
      this.tokenStorageService = serviceManager.getService<TokenStorageService>('tokenStorageService') || null;

      if (!this.cacheService) {
        this.logWarn('CacheService not available - warming disabled');
        return;
      }

      // Load existing data
      await this.loadMetrics();
      await this.loadUserActivities();
      await this.loadPendingTasks();

      // Start warming scheduler
      this.startWarmingScheduler();

      this.logInfo('Cache Warming Service initialized successfully', {
        rulesCount: this.warmingRules.length,
        pendingTasks: this.warmingTasks.size,
        userActivities: this.userActivities.size,
        availableServices: {
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService
        }
      });

    } catch (error) {
      this.logError('Failed to initialize Cache Warming Service', error);
      throw error;
    }
  }

  /**
   * Warm cache for a specific user
   */
  async warmUserCache(userId: string, trigger: string = 'manual'): Promise<void> {
    try {
      this.logInfo('Starting cache warming for user', { userId, trigger });

      const userActivity = this.userActivities.get(userId);
      const accessToken = await this.getUserAccessToken(userId);

      if (!accessToken) {
        this.logWarn('No access token available for user, skipping warming', { userId });
        return;
      }

      // Find applicable warming rules
      const applicableRules = this.warmingRules.filter(rule =>
        rule.enabled && this.isRuleApplicable(rule, trigger, userActivity)
      );

      if (applicableRules.length === 0) {
        this.logDebug('No applicable warming rules for user', { userId, trigger });
        return;
      }

      // Create warming tasks
      const tasks: WarmingTask[] = [];
      for (const rule of applicableRules) {
        for (const dataType of rule.dataTypes) {
          const task = this.createWarmingTask(userId, dataType, rule);
          tasks.push(task);
          this.warmingTasks.set(task.id, task);
        }
      }

      // Execute tasks by priority
      const sortedTasks = tasks.sort((a, b) => a.priority - b.priority);

      for (const task of sortedTasks) {
        await this.executeWarmingTask(task, accessToken);
      }

      this.logInfo('Cache warming completed for user', {
        userId,
        tasksExecuted: tasks.length,
        successful: tasks.filter(t => t.success).length
      });

    } catch (error) {
      this.logError('Failed to warm user cache', { userId, trigger, error });
    }
  }

  /**
   * Warm cache based on upcoming events
   */
  async warmForUpcomingEvents(userId: string): Promise<void> {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      if (!accessToken) return;

      this.logInfo('Warming cache for upcoming events', { userId });

      // Get upcoming meetings in next 2 hours
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      if (this.calendarCacheService) {
        // Preload upcoming calendar events
        await this.calendarCacheService.getEvents(accessToken, {
          timeMin: now.toISOString(),
          timeMax: twoHoursLater.toISOString(),
          maxResults: 10
        });

        // Preload availability for common meeting times
        const commonMeetingTimes = this.generateCommonMeetingTimes();
        for (const timeSlot of commonMeetingTimes) {
          await this.calendarCacheService.checkAvailability(
            accessToken,
            timeSlot.start,
            timeSlot.end
          );
        }
      }

      this.logDebug('Upcoming events cache warming completed', { userId });

    } catch (error) {
      this.logError('Failed to warm cache for upcoming events', { userId, error });
    }
  }

  /**
   * Warm frequently accessed contacts
   */
  async warmFrequentContacts(userId: string): Promise<void> {
    try {
      const userActivity = this.userActivities.get(userId);
      if (!userActivity || !this.contactCacheService) return;

      this.logInfo('Warming cache for frequent contacts', { userId });

      // Get list of frequent contacts from user activity or email patterns
      const frequentContacts = await this.getFrequentContacts(userId);

      for (const contactName of frequentContacts) {
        await this.contactCacheService.findContact(contactName, userId);
      }

      this.logDebug('Frequent contacts cache warming completed', {
        userId,
        contactsWarmed: frequentContacts.length
      });

    } catch (error) {
      this.logError('Failed to warm frequent contacts cache', { userId, error });
    }
  }

  /**
   * Warm recent email searches
   */
  async warmRecentEmailSearches(userId: string): Promise<void> {
    try {
      if (!this.gmailCacheService) return;

      this.logInfo('Warming cache for recent email searches', { userId });

      const accessToken = await this.getUserAccessToken(userId);
      if (!accessToken) return;

      // Common email search patterns
      const commonSearches = [
        'is:unread',
        'in:inbox',
        'from:calendar-notification@google.com',
        'has:attachment',
        'is:important'
      ];

      for (const search of commonSearches) {
        await this.gmailCacheService.searchEmails(accessToken, search, { maxResults: 20 });
      }

      this.logDebug('Recent email searches cache warming completed', { userId });

    } catch (error) {
      this.logError('Failed to warm recent email searches cache', { userId, error });
    }
  }

  /**
   * Schedule warming task
   */
  async scheduleWarmingTask(task: WarmingTask): Promise<void> {
    try {
      this.warmingTasks.set(task.id, task);

      if (task.strategy === WarmingStrategy.IMMEDIATE) {
        // Execute immediately
        const accessToken = await this.getUserAccessToken(task.userId);
        if (accessToken) {
          await this.executeWarmingTask(task, accessToken);
        }
      } else if (task.strategy === WarmingStrategy.SCHEDULED && task.scheduledTime) {
        // Will be picked up by the scheduler
        this.logDebug('Warming task scheduled', {
          taskId: task.id,
          scheduledTime: task.scheduledTime,
          dataType: task.dataType
        });
      }

    } catch (error) {
      this.logError('Failed to schedule warming task', { task, error });
    }
  }

  /**
   * Execute a warming task
   */
  private async executeWarmingTask(task: WarmingTask, accessToken: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.logDebug('Executing warming task', {
        taskId: task.id,
        dataType: task.dataType,
        priority: task.priority
      });

      task.executedTime = new Date();

      switch (task.dataType) {
        case 'upcoming_meetings':
          await this.warmForUpcomingEvents(task.userId);
          break;
        case 'frequent_contacts':
          await this.warmFrequentContacts(task.userId);
          break;
        case 'recent_emails':
          await this.warmRecentEmailSearches(task.userId);
          break;
        case 'calendar_today':
          await this.warmTodaysCalendar(task.userId, accessToken);
          break;
        case 'email_search_common':
          await this.warmCommonEmailSearches(task.userId, accessToken);
          break;
        default:
          this.logWarn('Unknown data type for warming task', {
            taskId: task.id,
            dataType: task.dataType
          });
          return;
      }

      const executionTime = Date.now() - startTime;
      task.success = true;
      task.executionTime = executionTime;

      this.updateTaskMetrics(task, executionTime, true);

      this.logDebug('Warming task completed successfully', {
        taskId: task.id,
        executionTime: `${executionTime}ms`
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      task.success = false;
      task.executionTime = executionTime;
      task.retryCount++;

      this.updateTaskMetrics(task, executionTime, false);

      this.logError('Warming task failed', {
        taskId: task.id,
        dataType: task.dataType,
        retryCount: task.retryCount,
        error
      });

      // Schedule retry if within retry limit
      if (task.retryCount < task.maxRetries) {
        setTimeout(() => {
          this.executeWarmingTask(task, accessToken).catch(err => {
            this.logError('Warming task retry failed', { taskId: task.id, error: err });
          });
        }, task.retryCount * 30000); // Exponential backoff
      }
    }
  }

  /**
   * Warm today's calendar
   */
  private async warmTodaysCalendar(userId: string, accessToken: string): Promise<void> {
    if (!this.calendarCacheService) return;

    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    await this.calendarCacheService.getEvents(accessToken, {
      timeMin: today.toISOString(),
      timeMax: tomorrow.toISOString(),
      maxResults: 50
    });
  }

  /**
   * Warm common email searches
   */
  private async warmCommonEmailSearches(userId: string, accessToken: string): Promise<void> {
    if (!this.gmailCacheService) return;

    const searches = [
      'is:unread in:inbox',
      'is:starred',
      'has:attachment',
      'in:sent',
      'label:important'
    ];

    for (const search of searches) {
      await this.gmailCacheService.searchEmails(accessToken, search, { maxResults: 10 });
    }
  }

  /**
   * Start the warming scheduler
   */
  private startWarmingScheduler(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.warmingInterval = setInterval(async () => {
      await this.processScheduledTasks();
    }, this.WARMING_INTERVAL_MS);

    this.logInfo('Cache warming scheduler started', {
      intervalMs: this.WARMING_INTERVAL_MS
    });
  }

  /**
   * Process scheduled warming tasks
   */
  private async processScheduledTasks(): Promise<void> {
    try {
      const now = new Date();
      const tasksToExecute: WarmingTask[] = [];

      // Find tasks ready for execution
      for (const task of this.warmingTasks.values()) {
        if (task.strategy === WarmingStrategy.SCHEDULED &&
            task.scheduledTime &&
            task.scheduledTime <= now &&
            !task.executedTime) {
          tasksToExecute.push(task);
        }
      }

      if (tasksToExecute.length === 0) {
        return;
      }

      this.logInfo('Processing scheduled warming tasks', { count: tasksToExecute.length });

      // Execute tasks in priority order
      tasksToExecute.sort((a, b) => a.priority - b.priority);

      for (const task of tasksToExecute) {
        const accessToken = await this.getUserAccessToken(task.userId);
        if (accessToken) {
          await this.executeWarmingTask(task, accessToken);
        }
      }

      this.metrics.lastWarmingRun = now;

    } catch (error) {
      this.logError('Failed to process scheduled warming tasks', error);
    }
  }

  /**
   * Utility methods
   */
  private createWarmingTask(userId: string, dataType: string, rule: WarmingRule): WarmingTask {
    const taskId = `${userId}_${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    return {
      id: taskId,
      userId,
      dataType,
      strategy: rule.strategy,
      priority: rule.priority,
      parameters: rule.parameters,
      scheduledTime: rule.strategy === WarmingStrategy.SCHEDULED ?
        this.calculateScheduleTime(rule.parameters) : undefined,
      retryCount: 0,
      maxRetries: 3
    };
  }

  private calculateScheduleTime(parameters: Record<string, any>): Date {
    const now = new Date();

    if (parameters.scheduleTime) {
      const [hours, minutes] = parameters.scheduleTime.split(':').map(Number);
      const scheduleTime = new Date(now);
      scheduleTime.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (scheduleTime <= now) {
        scheduleTime.setDate(scheduleTime.getDate() + 1);
      }

      return scheduleTime;
    }

    // Default to immediate execution
    return now;
  }

  private isRuleApplicable(rule: WarmingRule, trigger: string, userActivity?: UserActivity): boolean {
    switch (rule.condition) {
      case 'user_login':
        return trigger === 'user_login' || trigger === 'manual';
      case 'business_hours_start':
        return trigger === 'scheduled' && this.isNearBusinessHours();
      case 'pattern_detected':
        return userActivity && this.hasDetectedPatterns(userActivity, rule);
      case 'meeting_scheduled':
        return trigger === 'meeting_scheduled';
      default:
        return false;
    }
  }

  private isNearBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();

    // Consider "near business hours" as 7-9 AM
    return hour >= 7 && hour <= 9;
  }

  private hasDetectedPatterns(userActivity: UserActivity, rule: WarmingRule): boolean {
    // Simple pattern detection based on frequent data types
    return userActivity.frequentDataTypes.some(dataType =>
      rule.dataTypes.includes(dataType)
    );
  }

  private async getUserAccessToken(userId: string): Promise<string | null> {
    if (!this.tokenStorageService) return null;

    try {
      return await this.tokenStorageService.getGoogleAccessToken(userId);
    } catch (error) {
      this.logWarn('Failed to get access token for user', { userId, error });
      return null;
    }
  }

  private generateCommonMeetingTimes(): Array<{ start: string; end: string }> {
    const now = new Date();
    const slots: Array<{ start: string; end: string }> = [];

    // Generate slots for next 4 hours
    for (let i = 1; i <= 4; i++) {
      const startTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      slots.push({
        start: startTime.toISOString(),
        end: endTime.toISOString()
      });
    }

    return slots;
  }

  private async getFrequentContacts(userId: string): Promise<string[]> {
    // In a real implementation, this would analyze email patterns, calendar attendees, etc.
    // For now, return some common contact patterns
    return [
      'john',
      'sarah',
      'mike',
      'admin',
      'support',
      'team'
    ];
  }

  private updateTaskMetrics(task: WarmingTask, executionTime: number, success: boolean): void {
    this.metrics.totalTasks++;

    if (success) {
      this.metrics.successfulTasks++;
    } else {
      this.metrics.failedTasks++;
    }

    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime + executionTime) / 2;

    this.metrics.warmingByPriority[task.priority]++;
    this.metrics.warmingByDataType[task.dataType] =
      (this.metrics.warmingByDataType[task.dataType] || 0) + 1;
  }

  /**
   * Public API methods
   */

  /**
   * Trigger warming on user login
   */
  async onUserLogin(userId: string): Promise<void> {
    await this.warmUserCache(userId, 'user_login');
    this.updateUserActivity(userId, 'login');
  }

  /**
   * Trigger warming when meeting is scheduled
   */
  async onMeetingScheduled(userId: string, meetingDetails: any): Promise<void> {
    // Create immediate warming task for meeting-related data
    const task: WarmingTask = {
      id: `meeting_${userId}_${Date.now()}`,
      userId,
      dataType: 'meeting_participants',
      strategy: WarmingStrategy.EVENT_DRIVEN,
      priority: WarmingPriority.HIGH,
      parameters: { meetingDetails },
      retryCount: 0,
      maxRetries: 2
    };

    await this.scheduleWarmingTask(task);
  }

  /**
   * Update user activity patterns
   */
  updateUserActivity(userId: string, action: string): void {
    const now = new Date();
    const existing = this.userActivities.get(userId);

    if (existing) {
      existing.lastLogin = now;
      if (!existing.commonOperations.includes(action)) {
        existing.commonOperations.push(action);
      }
    } else {
      this.userActivities.set(userId, {
        userId,
        lastLogin: now,
        activeHours: [now.getHours()],
        frequentDataTypes: [],
        averageSessionDuration: 0,
        commonOperations: [action]
      });
    }
  }

  /**
   * Get warming metrics
   */
  getMetrics(): WarmingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pending warming tasks
   */
  getPendingTasks(): WarmingTask[] {
    return Array.from(this.warmingTasks.values()).filter(task => !task.executedTime);
  }

  /**
   * Data persistence methods
   */
  private async loadMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<WarmingMetrics>('cache_warming_metrics');
      if (cached) {
        this.metrics = cached;
        this.logDebug('Cache warming metrics loaded', this.metrics);
      }
    } catch (error) {
      this.logWarn('Failed to load cache warming metrics', { error });
    }
  }

  private async loadUserActivities(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<UserActivity[]>('cache_warming_user_activities');
      if (cached && Array.isArray(cached)) {
        this.userActivities.clear();
        cached.forEach(activity => {
          this.userActivities.set(activity.userId, activity);
        });
        this.logDebug('User activities loaded', { count: cached.length });
      }
    } catch (error) {
      this.logWarn('Failed to load user activities', { error });
    }
  }

  private async loadPendingTasks(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<WarmingTask[]>('cache_warming_pending_tasks');
      if (cached && Array.isArray(cached)) {
        this.warmingTasks.clear();
        cached.forEach(task => {
          this.warmingTasks.set(task.id, task);
        });
        this.logDebug('Pending warming tasks loaded', { count: cached.length });
      }
    } catch (error) {
      this.logWarn('Failed to load pending warming tasks', { error });
    }
  }

  private async saveData(): Promise<void> {
    if (!this.cacheService) return;

    try {
      await Promise.all([
        this.cacheService.set('cache_warming_metrics', this.metrics, 86400),
        this.cacheService.set('cache_warming_user_activities',
          Array.from(this.userActivities.values()), 86400),
        this.cacheService.set('cache_warming_pending_tasks',
          Array.from(this.warmingTasks.values()), 86400)
      ]);
    } catch (error) {
      this.logWarn('Failed to save warming service data', { error });
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }

    if (this.cacheService) {
      await this.saveData();
    }

    this.logInfo('Cache Warming Service destroyed');
  }

  /**
   * Health check
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: true,
      details: {
        cacheServiceAvailable: !!this.cacheService,
        schedulerRunning: !!this.warmingInterval,
        pendingTasks: this.warmingTasks.size,
        userActivities: this.userActivities.size,
        metrics: this.metrics,
        availableServices: {
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService,
          tokenStorage: !!this.tokenStorageService
        }
      }
    };
  }
}