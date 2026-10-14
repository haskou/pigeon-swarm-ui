import type { GroupMailboxGenerationLog } from '../GroupMailboxGenerationLog';

/**
 * Device-local generations of each group conversation. Never synced: a
 * generation secret opens every member mailbox of that generation.
 */
export interface GroupMailboxGenerationRepository {
  /** The conversations whose log opens on this device. */
  conversationIds(): Promise<string[]>;
  /** The empty log when this device holds no generation for the group. */
  load(conversationId: string): Promise<GroupMailboxGenerationLog>;
  save(conversationId: string, log: GroupMailboxGenerationLog): Promise<void>;
}
