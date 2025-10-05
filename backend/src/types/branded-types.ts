/**
 * Branded types for type-safe IDs
 *
 * Prevents mixing up different types of IDs at compile time.
 *
 * @example
 * const userId = BrandedId.user('user-123');
 * const messageId = BrandedId.message('msg-456');
 *
 * // This would be a compile error:
 * await emailService.getEmail(messageId, userId); // ❌ Wrong order!
 *
 * // This compiles:
 * await emailService.getEmail(userId, messageId); // ✅ Correct!
 */

export type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type EventId = Brand<string, 'EventId'>;
export type ContactId = Brand<string, 'ContactId'>;
export type CalendarId = Brand<string, 'CalendarId'>;
export type ChannelId = Brand<string, 'ChannelId'>;

/**
 * Helper functions to create branded types
 */
export const BrandedId = {
  user: (id: string): UserId => id as UserId,
  message: (id: string): MessageId => id as MessageId,
  thread: (id: string): ThreadId => id as ThreadId,
  event: (id: string): EventId => id as EventId,
  contact: (id: string): ContactId => id as ContactId,
  calendar: (id: string): CalendarId => id as CalendarId,
  channel: (id: string): ChannelId => id as ChannelId,
};

/**
 * Type guard to check if a value is a branded ID
 */
export function isBrandedId<T extends string>(
  value: unknown,
  brand: T
): value is Brand<string, T> {
  return typeof value === 'string';
}
