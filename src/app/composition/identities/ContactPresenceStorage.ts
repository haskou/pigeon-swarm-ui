import type { MailboxContactPresenceRepository } from '../../../contexts/identities/infrastructure/presence/MailboxContactPresenceRepository';
import type { SealedPresenceSharingRepository } from '../../../contexts/identities/infrastructure/storage/SealedPresenceSharingRepository';

/** This device's contact presence state, for forget, revoke and logout. */
export type ContactPresenceStorage = {
  inboxes: MailboxContactPresenceRepository;
  sharings: SealedPresenceSharingRepository;
};
