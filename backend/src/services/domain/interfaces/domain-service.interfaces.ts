/**
 * Domain Service Interfaces - Abstract interfaces for dependency injection
 *
 * This module defines interfaces for all domain services, enabling dependency
 * injection and loose coupling between components.
 *
 * Note: OAuth is handled by Supabase Auth. Domain services use SupabaseTokenProvider
 * to fetch Google provider tokens from Supabase.
 */

import { APIClientError } from '../../../errors';

// Base domain service interface
export interface IDomainService {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  getHealth(): { healthy: boolean; details?: Record<string, unknown> };
}

// Email domain service interface
export interface IEmailDomainService extends IDomainService {
  // Domain operations (authentication via Supabase)
  sendEmail(userId: string, params: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<{
    messageId: string;
    threadId: string;
  }>;
  searchEmails(userId: string, params: {
    query: string;
    maxResults?: number;
    includeSpamTrash?: boolean;
  }): Promise<Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    date: Date;
    snippet: string;
    labels: string[];
    isUnread: boolean;
    hasAttachments: boolean;
  }>>;
  getEmail(messageId: string): Promise<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    date: Date;
    body: {
      text?: string;
      html?: string;
    };
    snippet: string;
    labels: string[];
    attachments?: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }>;
  }>;
  replyToEmail(params: {
    messageId: string;
    replyBody: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<{
    messageId: string;
    threadId: string;
  }>;
  getEmailThread(threadId: string): Promise<{
    id: string;
    messages: Array<{
      id: string;
      subject: string;
      from: string;
      to: string[];
      date: Date;
      body: { text?: string; html?: string };
      snippet: string;
    }>;
  }>;
}

// Calendar domain service interface
export interface ICalendarDomainService extends IDomainService {
  // Domain operations (authentication via Supabase)
  createEvent(userId: string, params: {
    summary: string;
    description?: string;
    start: {
      dateTime: string;
      timeZone?: string;
    };
    end: {
      dateTime: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email: string;
      responseStatus?: string;
    }>;
    location?: string;
    recurrence?: string[];
    conferenceData?: {
      createRequest?: {
        requestId: string;
        conferenceSolutionKey: {
          type: string;
        };
      };
    };
    calendarId?: string;
  }): Promise<{
    id: string;
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
  }>;
  listEvents(userId: string, params: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
    q?: string;
  }): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
    status: string;
  }>>;
  getEvent(eventId: string, calendarId?: string): Promise<{
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
    status: string;
    recurrence?: string[];
  }>;
  updateEvent(userId: string, params: {
    eventId: string;
    calendarId?: string;
    summary?: string;
    description?: string;
    start?: {
      dateTime: string;
      timeZone?: string;
    };
    end?: {
      dateTime: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email: string;
      responseStatus?: string;
    }>;
    location?: string;
  }): Promise<{
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
  }>;
  deleteEvent(userId: string, eventId: string, calendarId?: string): Promise<void>;
  checkAvailability(userId: string, params: {
    timeMin: string;
    timeMax: string;
    calendarIds?: string[];
  }): Promise<{
    busy: boolean;
    conflicts: Array<{
      start: string;
      end: string;
    }>;
  }>;
  findAvailableSlots(userId: string, params: {
    startDate: string;
    endDate: string;
    durationMinutes: number;
    calendarIds?: string[];
  }): Promise<Array<{
    start: string;
    end: string;
  }>>;
  listCalendars(userId: string): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    primary: boolean;
    accessRole: string;
    backgroundColor?: string;
    foregroundColor?: string;
  }>>;
}

// Contacts domain service interface
export interface IContactsDomainService extends IDomainService {
  // Domain operations (authentication via Supabase)
  listContacts(userId: string, params: {
    pageSize?: number;
    pageToken?: string;
    personFields?: string[];
    sortOrder?: 'LAST_NAME_ASCENDING' | 'LAST_NAME_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'FIRST_NAME_DESCENDING';
  }): Promise<{
    contacts: Array<{
      resourceName: string;
      names?: Array<{
        displayName?: string;
        givenName?: string;
        familyName?: string;
        middleName?: string;
      }>;
      emailAddresses?: Array<{
        value: string;
        type?: string;
        displayName?: string;
      }>;
      phoneNumbers?: Array<{
        value: string;
        type?: string;
      }>;
      addresses?: Array<{
        formattedValue?: string;
        type?: string;
        streetAddress?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
      }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        type?: string;
      }>;
      photos?: Array<{
        url: string;
        default?: boolean;
      }>;
    }>;
    nextPageToken?: string;
    totalItems?: number;
  }>;
  createContact(params: {
    names?: Array<{
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      type?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    birthdays?: Array<{
      date?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }>;
  }): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
  }>;
  getContact(userId: string, resourceName: string, personFields?: string[]): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    photos?: Array<{
      url: string;
      default?: boolean;
    }>;
  }>;
  updateContact(params: {
    resourceName: string;
    names?: Array<{
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      type?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    birthdays?: Array<{
      date?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }>;
  }): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
  }>;
  deleteContact(userId: string, resourceName: string): Promise<void>;
  searchContacts(userId: string, params: {
    query: string;
    pageSize?: number;
    pageToken?: string;
    personFields?: string[];
  }): Promise<{
    contacts: Array<{
      resourceName: string;
      names?: Array<{
        displayName?: string;
        givenName?: string;
        familyName?: string;
        middleName?: string;
      }>;
      emailAddresses?: Array<{
        value: string;
        type?: string;
        displayName?: string;
      }>;
      phoneNumbers?: Array<{
        value: string;
        type?: string;
      }>;
      addresses?: Array<{
        formattedValue?: string;
        type?: string;
        streetAddress?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
      }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        type?: string;
      }>;
    }>;
    nextPageToken?: string;
    totalItems?: number;
  }>;
}

// Slack domain service interface (REMOVED - Slack bot deprecated)
// If Slack is needed in future, it will use Supabase OAuth
export interface ISlackDomainService extends IDomainService {
  // Domain operations (authentication via Supabase)
  sendMessage(userId: string, params: {
    channel: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
    threadTs?: string;
    replyBroadcast?: boolean;
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
  }): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
    message: {
      text: string;
      user: string;
      botId?: string;
      attachments?: any[];
      blocks?: any[];
    };
  }>;
  updateMessage(params: {
    channel: string;
    ts: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
  }): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
    text: string;
  }>;
  deleteMessage(channel: string, ts: string): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
  }>;
  getChannelHistory(params: {
    channel: string;
    limit?: number;
    oldest?: string;
    latest?: string;
    inclusive?: boolean;
    cursor?: string;
  }): Promise<{
    ok: boolean;
    messages: Array<{
      type: string;
      subtype?: string;
      text: string;
      user: string;
      ts: string;
      threadTs?: string;
      replyCount?: number;
      replies?: any[];
      attachments?: any[];
      blocks?: any[];
    }>;
    hasMore: boolean;
    pinCount: number;
    responseMetadata?: {
      nextCursor?: string;
    };
  }>;
  getThreadReplies(params: {
    channel: string;
    ts: string;
    limit?: number;
    oldest?: string;
    latest?: string;
    inclusive?: boolean;
    cursor?: string;
  }): Promise<{
    ok: boolean;
    messages: Array<{
      type: string;
      subtype?: string;
      text: string;
      user: string;
      ts: string;
      threadTs?: string;
      replyCount?: number;
      replies?: any[];
      attachments?: any[];
      blocks?: any[];
    }>;
    hasMore: boolean;
    responseMetadata?: {
      nextCursor?: string;
    };
  }>;
  getUserInfo(userId: string): Promise<{
    ok: boolean;
    user: {
      id: string;
      name: string;
      realName: string;
      displayName?: string;
      email?: string;
      isBot: boolean;
      isAdmin: boolean;
      isOwner: boolean;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName: string;
        realNameNormalized: string;
        displayName?: string;
        displayNameNormalized?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
      };
    };
  }>;
  listUsers(params: {
    limit?: number;
    cursor?: string;
    includeLocale?: boolean;
  }): Promise<{
    ok: boolean;
    members: Array<{
      id: string;
      name: string;
      realName: string;
      displayName?: string;
      email?: string;
      isBot: boolean;
      isAdmin: boolean;
      isOwner: boolean;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName: string;
        realNameNormalized: string;
        displayName?: string;
        displayNameNormalized?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
      };
    }>;
    cacheTs: number;
    responseMetadata?: {
      nextCursor?: string;
    };
  }>;
  uploadFile(params: {
    channels?: string;
    content?: string;
    file?: Buffer;
    filename?: string;
    title?: string;
    initialComment?: string;
    threadTs?: string;
  }): Promise<{
    ok: boolean;
    file: {
      id: string;
      name: string;
      title: string;
      mimetype: string;
      filetype: string;
      prettyType: string;
      user: string;
      size: number;
      urlPrivate: string;
      urlPrivateDownload: string;
      permalink: string;
      permalinkPublic: string;
      isExternal: boolean;
      isPublic: boolean;
      publicUrlShared: boolean;
      displayAsBot: boolean;
      username: string;
      created: number;
      updated: number;
      mode: string;
      editable: boolean;
      isStarred: boolean;
      hasRichPreview: boolean;
    };
  }>;
  testAuth(): Promise<{
    ok: boolean;
    url: string;
    team: string;
    user: string;
    teamId: string;
    userId: string;
    botId?: string;
    isEnterpriseInstall: boolean;
  }>;
  processEvent(event: any, context: any): Promise<any>;
  sendToResponseUrl(responseUrl: string, payload: any): Promise<void>;
}

// AI domain service interface
export interface IAIDomainService extends IDomainService {
  authenticate(apiKey: string): Promise<void>;
  generateChatCompletion(params: {
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
  }): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string;
      };
      finishReason: string;
    }>;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
  generateTextCompletion(params: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
  }): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      text: string;
      index: number;
      finishReason: string;
    }>;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
  generateEmbeddings(params: {
    input: string | string[];
    model?: string;
  }): Promise<{
    object: string;
    data: Array<{
      object: string;
      index: number;
      embedding: number[];
    }>;
    model: string;
    usage: {
      promptTokens: number;
      totalTokens: number;
    };
  }>;
  generateImages(params: {
    prompt: string;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024';
    responseFormat?: 'url' | 'b64_json';
    user?: string;
  }): Promise<{
    created: number;
    data: Array<{
      url?: string;
      b64Json?: string;
    }>;
  }>;
  transcribeAudio(params: {
    file: Buffer;
    model?: string;
    language?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  }): Promise<{
    text: string;
  }>;
  translateAudio(params: {
    file: Buffer;
    model?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  }): Promise<{
    text: string;
  }>;
  listModels(): Promise<{
    object: string;
    data: Array<{
      id: string;
      object: string;
      created: number;
      ownedBy: string;
      permission: Array<{
        id: string;
        object: string;
        created: number;
        allowCreateEngine: boolean;
        allowSampling: boolean;
        allowLogprobs: boolean;
        allowSearchIndices: boolean;
        allowView: boolean;
        allowFineTuning: boolean;
        organization: string;
        group?: string;
        isBlocking: boolean;
      }>;
      root: string;
      parent?: string;
    }>;
  }>;
  generateStructuredData(
    userPrompt: string,
    systemPrompt: string,
    schema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
      description?: string;
    },
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<any>;
}
