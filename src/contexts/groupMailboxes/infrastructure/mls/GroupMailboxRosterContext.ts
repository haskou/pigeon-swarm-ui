import type { MlsContextExtension } from '@haskou/pigeon-swarm-crypto/mls';

import {
  GroupMailboxRosterExtension,
  InvalidMlsExtensionError,
} from '@haskou/pigeon-swarm-crypto/mls';

import { GroupMailboxRoster } from '../../domain/GroupMailboxRoster';

/**
 * The roster of a group conversation in its MLS GroupContext, encoded by the
 * library's GroupContext extension `GroupMailboxRosterExtension` (0xf421).
 * Every member agrees on the GroupContext, so every member judges a commit
 * by the same roster.
 */
export class GroupMailboxRosterContext {
  /**
   * The roster of a context holding exactly the roster extension; undefined
   * for any other context.
   */
  public static read(
    extensions: readonly MlsContextExtension[],
  ): GroupMailboxRoster | undefined {
    try {
      return GroupMailboxRoster.of(
        GroupMailboxRosterExtension.read(extensions),
      );
    } catch (error) {
      if (error instanceof InvalidMlsExtensionError) return undefined;
      throw error;
    }
  }

  /** The GroupContext extension that carries the roster. */
  public static extension(roster: GroupMailboxRoster): MlsContextExtension {
    return {
      extensionData: GroupMailboxRosterExtension.encode(roster.toFields()),
      extensionType: GroupMailboxRosterExtension.EXTENSION_TYPE,
    };
  }
}
