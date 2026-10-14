import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContexts } from '../http/IdentityAccessContexts';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
import { PresenceSharing } from '../../domain/PresenceSharing';

/**
 * The contacts this device shares presence with, sealed under the
 * device-sealed root, one entry per direct conversation. Nothing about whom
 * an identity shares with is readable at rest or leaves the device.
 */
// eslint-disable-next-line max-len
export class SealedPresenceSharingRepository implements PresenceSharingRepository {
  private static readonly DATABASE = 'pigeon-presence-sharing';
  private static readonly KIND = 'presence-sharing';

  private state?: DeviceSealedEntryStore;

  public constructor(private readonly contexts: IdentityAccessContexts) {}

  /** Opened on first use: the database name needs the chosen node. */
  private store(): DeviceSealedEntryStore {
    this.state ??= new DeviceSealedEntryStore(
      scopeClientStorageKey(SealedPresenceSharingRepository.DATABASE),
      SealedPresenceSharingRepository.DATABASE,
    );

    return this.state;
  }

  /** Drops the keys held in memory, for logout. Sharings are kept. */
  public close(): void {
    this.state?.close();
  }

  public async delete(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
  ): Promise<void> {
    await this.store().delete(
      this.contexts.find(actorIdentityId).session,
      SealedPresenceSharingRepository.KIND,
      sharing.toPrimitives().conversationId,
    );
  }

  /** Drops every sharing of the identity, as when the device was removed. */
  public async forget(identityId: string): Promise<void> {
    await this.store().forget(identityId);
  }

  public async save(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
  ): Promise<void> {
    const primitives = sharing.toPrimitives();

    await this.store().put(
      this.contexts.find(actorIdentityId).session,
      SealedPresenceSharingRepository.KIND,
      primitives.conversationId,
      new TextEncoder().encode(primitives.contactIdentityId),
    );
  }

  public async search(actorIdentityId: IdentityId): Promise<PresenceSharing[]> {
    const entries = await this.store().list(
      this.contexts.find(actorIdentityId).session,
      SealedPresenceSharingRepository.KIND,
    );

    return entries.map(({ id, value }) =>
      PresenceSharing.fromPrimitives({
        contactIdentityId: new TextDecoder().decode(value),
        conversationId: id,
      }),
    );
  }
}
