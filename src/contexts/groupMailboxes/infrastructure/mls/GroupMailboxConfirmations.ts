import type { MlsStateStore } from '../../../communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxConfirmation } from './GroupMailboxConfirmation';

import { GroupMailboxGenesis } from '../../domain/GroupMailboxGenesis';

/**
 * The confirmation of each group this device holds, and the genesis of
 * each group it learned one for, sealed in the device's MLS state store
 * (node `docs/design/group-roster-in-mls.md`, "Joiners and the welcome").
 * A group without a readable record is unconfirmed and has no confirmer:
 * nothing confirms it, so this device never speaks in it.
 */
export class GroupMailboxConfirmations {
  private static readonly UNCONFIRMED: GroupMailboxConfirmation = {
    confirmed: false,
    confirmers: [],
  };

  private readonly known = new Map<string, GroupMailboxConfirmation>();

  /** A stored record; anything unreadable is unconfirmed with no confirmer. */
  private static decode(
    bytes: Uint8Array | undefined,
  ): GroupMailboxConfirmation {
    try {
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));

      if (typeof value !== 'object' || value === null) {
        return GroupMailboxConfirmations.UNCONFIRMED;
      }
      const record: Record<string, unknown> = { ...value };

      if (record.confirmed === true) return { confirmed: true };
      const { confirmers } = record;

      return record.confirmed === false &&
        Array.isArray(confirmers) &&
        confirmers.every((identityId) => typeof identityId === 'string')
        ? { confirmed: false, confirmers: confirmers.map(String) }
        : GroupMailboxConfirmations.UNCONFIRMED;
    } catch {
      return GroupMailboxConfirmations.UNCONFIRMED;
    }
  }

  public constructor(private readonly store: MlsStateStore) {}

  /** The genesis this device learned for the group, if any. */
  public async genesis(
    conversationId: string,
  ): Promise<GroupMailboxGenesis | undefined> {
    const bytes = await this.store.loadGroup(`${conversationId}#genesis`);

    if (!bytes?.length) return undefined;

    try {
      return GroupMailboxGenesis.of(
        conversationId,
        JSON.parse(new TextDecoder().decode(bytes)),
      );
    } catch {
      return undefined;
    }
  }

  public async learn(genesis: GroupMailboxGenesis): Promise<void> {
    await this.store.saveGroup(
      `${genesis.conversationId}#genesis`,
      new TextEncoder().encode(JSON.stringify(genesis.toPrimitives())),
    );
  }

  public async of(conversationId: string): Promise<GroupMailboxConfirmation> {
    const cached = this.known.get(conversationId);

    if (cached) return cached;
    const confirmation = GroupMailboxConfirmations.decode(
      await this.store.loadGroup(`${conversationId}#confirmation`),
    );

    this.known.set(conversationId, confirmation);

    return confirmation;
  }

  /**
   * Keeps the confirmation of a group. A joined group's is written before
   * its state, so a group whose save failed never inherits the record of
   * an earlier membership.
   */
  public async record(
    conversationId: string,
    confirmation: GroupMailboxConfirmation,
  ): Promise<void> {
    this.known.delete(conversationId);
    await this.store.saveGroup(
      `${conversationId}#confirmation`,
      new TextEncoder().encode(JSON.stringify(confirmation)),
    );
    this.known.set(conversationId, confirmation);
  }

  /**
   * A valid commit or message from `identityId` confirms the group when
   * that identity is one of its confirmers.
   */
  public async witness(
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    const confirmation = await this.of(conversationId);

    if (
      !confirmation.confirmed &&
      confirmation.confirmers.includes(identityId)
    ) {
      await this.record(conversationId, { confirmed: true });
    }
  }
}
