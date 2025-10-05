/**
 * Contacts Domain Service Interface
 * Focused interface for contact-related operations
 */

import { IDomainService } from './base-domain.interface';

/**
 * Contact phone number
 */
export interface ContactPhoneNumber {
  value: string;
  type: 'home' | 'work' | 'mobile' | 'fax' | 'other';
  primary?: boolean;
}

/**
 * Contact email address
 */
export interface ContactEmailAddress {
  value: string;
  type: 'home' | 'work' | 'other';
  primary?: boolean;
}

/**
 * Contact address
 */
export interface ContactAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type: 'home' | 'work' | 'other';
  primary?: boolean;
}

/**
 * Contact organization
 */
export interface ContactOrganization {
  name?: string;
  title?: string;
  department?: string;
  symbol?: string;
  domain?: string;
  location?: string;
  type?: string;
  primary?: boolean;
}

/**
 * Contact relationship
 */
export interface ContactRelationship {
  person: string;
  type: string;
}

/**
 * Contact event (birthday, anniversary, etc.)
 */
export interface ContactEvent {
  date: {
    year?: number;
    month: number;
    day: number;
  };
  type: 'birthday' | 'anniversary' | 'other';
}

/**
 * Contact input for creation/update
 */
export interface ContactInput {
  names?: Array<{
    givenName?: string;
    familyName?: string;
    middleName?: string;
    honorificPrefix?: string;
    honorificSuffix?: string;
    phoneticGivenName?: string;
    phoneticFamilyName?: string;
    phoneticMiddleName?: string;
    displayName?: string;
  }>;
  phoneNumbers?: ContactPhoneNumber[];
  emailAddresses?: ContactEmailAddress[];
  addresses?: ContactAddress[];
  organizations?: ContactOrganization[];
  biographies?: Array<{
    value: string;
    contentType: 'TEXT_PLAIN' | 'TEXT_HTML';
  }>;
  birthdays?: ContactEvent[];
  events?: ContactEvent[];
  relations?: ContactRelationship[];
  urls?: Array<{
    value: string;
    type: string;
  }>;
  nicknames?: Array<{
    value: string;
    type: 'DEFAULT' | 'MAIDEN_NAME' | 'INITIALS' | 'GPLUS' | 'OTHER_NAME';
  }>;
  occupations?: Array<{
    value: string;
  }>;
  interests?: Array<{
    value: string;
  }>;
}

/**
 * Contact details
 */
export interface Contact {
  resourceName: string;
  etag: string;
  metadata: {
    sources: Array<{
      type: string;
      id: string;
      etag?: string;
      updateTime?: string;
    }>;
    objectType: 'PERSON';
  };
  names?: Array<{
    givenName?: string;
    familyName?: string;
    middleName?: string;
    honorificPrefix?: string;
    honorificSuffix?: string;
    phoneticGivenName?: string;
    phoneticFamilyName?: string;
    phoneticMiddleName?: string;
    displayName?: string;
    displayNameLastFirst?: string;
    unstructuredName?: string;
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  phoneNumbers?: ContactPhoneNumber[];
  emailAddresses?: ContactEmailAddress[];
  addresses?: ContactAddress[];
  organizations?: ContactOrganization[];
  biographies?: Array<{
    value: string;
    contentType: 'TEXT_PLAIN' | 'TEXT_HTML';
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  birthdays?: ContactEvent[];
  events?: ContactEvent[];
  relations?: ContactRelationship[];
  urls?: Array<{
    value: string;
    type: string;
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  photos?: Array<{
    url: string;
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  nicknames?: Array<{
    value: string;
    type: 'DEFAULT' | 'MAIDEN_NAME' | 'INITIALS' | 'GPLUS' | 'OTHER_NAME';
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  occupations?: Array<{
    value: string;
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
  interests?: Array<{
    value: string;
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id: string;
      };
    };
  }>;
}

/**
 * Contact search parameters
 */
export interface ContactSearchParams {
  query?: string;
  pageSize?: number;
  pageToken?: string;
  readMask?: string;
  sources?: string[];
}

/**
 * Contact search result
 */
export interface ContactSearchResult {
  results: Array<{
    person: Contact;
  }>;
  nextPageToken?: string;
  totalSize?: number;
}

/**
 * Contact group information
 */
export interface ContactGroup {
  resourceName: string;
  etag: string;
  metadata: {
    updateTime: string;
    deleted?: boolean;
    objectType: 'CONTACT_GROUP';
  };
  groupType: 'USER_CONTACT_GROUP' | 'SYSTEM_CONTACT_GROUP';
  name: string;
  formattedName?: string;
  memberResourceNames?: string[];
  memberCount?: number;
  clientData?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Contact list parameters
 */
export interface ContactListParams {
  pageSize?: number;
  pageToken?: string;
  readMask?: string;
  sources?: string[];
  syncToken?: string;
  sortOrder?: 'LAST_MODIFIED_ASCENDING' | 'LAST_MODIFIED_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
}

/**
 * Contacts Domain Service Interface
 * Handles all contact-related operations with automatic OAuth management
 */
export interface IContactsDomainService extends IDomainService {
  // ===== Contact Operations =====

  /**
   * Create a new contact
   */
  createContact(userId: string, contact: ContactInput): Promise<Contact>;

  /**
   * Get contact details
   */
  getContact(userId: string, contactId: string): Promise<Contact>;

  /**
   * Update contact
   */
  updateContact(userId: string, contactId: string, contact: ContactInput, updatePersonFields?: string): Promise<Contact>;

  /**
   * Delete contact
   */
  deleteContact(userId: string, contactId: string): Promise<void>;

  /**
   * List contacts
   */
  listContacts(userId: string, params?: ContactListParams): Promise<{
    connections: Contact[];
    nextPageToken?: string;
    nextSyncToken?: string;
    totalPeople?: number;
    totalItems?: number;
  }>;

  /**
   * Search contacts
   */
  searchContacts(userId: string, params: ContactSearchParams): Promise<ContactSearchResult>;

  /**
   * Get contact by email
   */
  getContactByEmail(email: string): Promise<Contact | null>;

  /**
   * Get contact by phone number
   */
  getContactByPhone(phoneNumber: string): Promise<Contact | null>;

  // ===== Contact Groups =====

  /**
   * List contact groups
   */
  listContactGroups(userId: string, params?: {
    pageSize?: number;
    pageToken?: string;
    syncToken?: string;
  }): Promise<{
    contactGroups: ContactGroup[];
    nextPageToken?: string;
    nextSyncToken?: string;
    totalItems?: number;
  }>;

  /**
   * Get contact group
   */
  getContactGroup(groupId: string, maxMembers?: number): Promise<ContactGroup>;

  /**
   * Create contact group
   */
  createContactGroup(userId: string, name: string): Promise<ContactGroup>;

  /**
   * Update contact group
   */
  updateContactGroup(groupId: string, name: string): Promise<ContactGroup>;

  /**
   * Delete contact group
   */
  deleteContactGroup(groupId: string): Promise<void>;

  /**
   * Add contacts to group
   */
  addContactsToGroup(groupId: string, contactIds: string[]): Promise<ContactGroup>;

  /**
   * Remove contacts from group
   */
  removeContactsFromGroup(groupId: string, contactIds: string[]): Promise<ContactGroup>;

  // ===== Batch Operations =====

  /**
   * Get multiple contacts
   */
  batchGetContacts(userId: string, params: {
    resourceNames: string[];
    personFields?: string[];
  }): Promise<Array<Contact>>;

  /**
   * Update multiple contacts
   */
  batchUpdateContacts(updates: Array<{
    resourceName: string;
    person: ContactInput;
    updatePersonFields?: string;
  }>): Promise<{
    updateResult: Array<{
      person?: Contact;
      httpStatusCode: number;
      status?: any;
    }>;
  }>;

  /**
   * Delete multiple contacts
   */
  batchDeleteContacts(contactIds: string[]): Promise<void>;

  // ===== Import/Export Operations =====

  /**
   * Import contacts from VCard
   */
  importContacts(userId: string, vcardData: string): Promise<{
    imported: number;
    updated: number;
    errors: string[];
  }>;

  /**
   * Export contacts to VCard
   */
  exportContacts(userId: string, contactIds?: string[]): Promise<string>;

  /**
   * Sync contacts (get changes since last sync)
   */
  syncContacts(userId: string, syncToken: string): Promise<{
    connections: Contact[];
    nextSyncToken: string;
    changes: Array<{
      type: 'CREATED' | 'UPDATED' | 'DELETED';
      person: Contact;
    }>;
  }>;

  // ===== Utility Operations =====

  /**
   * Get user's profile
   */
  getUserProfile(userId: string): Promise<Contact>;

  /**
   * Update user's profile
   */
  updateUserProfile(userId: string, profile: ContactInput): Promise<Contact>;

  /**
   * Get contact photo
   */
  getContactPhoto(contactId: string): Promise<{
    url: string;
    photoBytes?: string;
  }>;

  /**
   * Update contact photo
   */
  updateContactPhoto(contactId: string, photoBytes: string): Promise<{
    person: Contact;
  }>;

  /**
   * Delete contact photo
   */
  deleteContactPhoto(contactId: string): Promise<{
    person: Contact;
  }>;

  /**
   * Merge duplicate contacts
   */
  mergeDuplicateContacts(contact1Id: string, contact2Id: string): Promise<Contact>;

  /**
   * Find duplicate contacts
   */
  findDuplicateContacts(userId: string): Promise<Array<{
    contacts: Contact[];
    similarity: number;
  }>>;

  /**
   * Get contact suggestions
   */
  getContactSuggestions(userId: string): Promise<Contact[]>;
}