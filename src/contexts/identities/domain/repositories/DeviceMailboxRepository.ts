import type { IdentityId } from '../value-objects/IdentityId';

/** This device's local direct- and group-mailbox state for one identity. */
export interface DeviceMailboxRepository {
  cancelOutbox(identityId: IdentityId): Promise<void>;
  forgetGroups(identityId: IdentityId): Promise<void>;
  forgetHistory(identityId: IdentityId): Promise<void>;
  releaseReaders(identityId: IdentityId): Promise<void>;
}
