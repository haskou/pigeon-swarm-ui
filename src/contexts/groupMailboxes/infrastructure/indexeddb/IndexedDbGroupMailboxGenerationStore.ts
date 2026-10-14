import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
import type { GroupMailboxGenerationPrimitives } from '../../domain/GroupMailboxGenerationPrimitives';
import type { GroupMailboxGenerationRepository } from '../../domain/repositories/GroupMailboxGenerationRepository';

import { GroupMailboxGenerationLog } from '../../domain/GroupMailboxGenerationLog';

/**
 * Generation logs of the session's identity on this device, one per
 * conversation, sealed under the device-sealed root
 * (`DeviceSealedEntryStore`). Stored next to the MLS state that can already
 * derive them.
 */
// eslint-disable-next-line max-len
export class IndexedDbGroupMailboxGenerationStore implements GroupMailboxGenerationRepository {
  public constructor(
    private readonly entries: DeviceSealedEntryStore,
    private readonly session: () => Session,
  ) {}

  public async conversationIds(): Promise<string[]> {
    return (await this.entries.list(this.session(), 'generations')).map(
      ({ id }) => id,
    );
  }

  public async load(
    conversationId: string,
  ): Promise<GroupMailboxGenerationLog> {
    const stored = await this.entries.get(
      this.session(),
      'generations',
      conversationId,
    );

    return stored
      ? GroupMailboxGenerationLog.fromPrimitives(
          JSON.parse(
            new TextDecoder().decode(stored),
          ) as GroupMailboxGenerationPrimitives[],
        )
      : GroupMailboxGenerationLog.empty();
  }

  public async save(
    conversationId: string,
    log: GroupMailboxGenerationLog,
  ): Promise<void> {
    await this.entries.put(
      this.session(),
      'generations',
      conversationId,
      new TextEncoder().encode(JSON.stringify(log.toPrimitives())),
    );
  }
}
