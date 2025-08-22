export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string | null;
  source: 'contacts' | 'other_contacts';
  lastInteraction?: Date;
  interactionCount?: number;
  confidence?: number; // For fuzzy matching results
}

export interface ContactSearchRequest {
  query: string;
  maxResults?: number;
  includeOtherContacts?: boolean; // Include frequently contacted people
}

export interface ContactSearchResult {
  contacts: Contact[];
  totalCount: number;
  totalResults: number;
  searchQuery: string;
  query: string;
  hasMore: boolean;
}

export interface ContactAgentRequest {
  query: string;
  operation?: 'search' | 'create' | 'update';
  contactData?: Partial<Contact>;
}

export interface ContactAgentResponse {
  success: boolean;
  message: string;
  data?: {
    contacts?: Contact[];
    contact?: Contact;
    totalCount?: number;
  };
  error?: string;
}

export interface GoogleContact {
  resourceName: string;
  etag: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  metadata?: {
    sources?: Array<{
      type: string;
      id: string;
      updateTime?: string;
    }>;
  };
}

export interface GooglePeopleResponse {
  connections?: GoogleContact[];
  nextPageToken?: string;
  totalPeople?: number;
}

export interface GoogleOtherContactsResponse {
  otherContacts?: GoogleContact[];
  nextPageToken?: string;
  totalSize?: number;
}

export class ContactServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ContactServiceError';
  }
}