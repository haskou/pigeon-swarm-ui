import type { Session } from '../session/Session';
import type { ContactDirectoryEntry } from './ContactDirectoryEntry';
import type { ContactDirectoryRow as Row } from './ContactDirectoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceSealedRowStore } from '../../../messages/infrastructure/mailbox/DeviceSealedRowStore';

/**
 * The display names of already-synchronized contacts, so they can be read and
 * searched while the node cannot answer profile reads. The directory is one
 * row sealed under the device-sealed root: no name or contact id is readable
 * at rest, a root change drops it, and without a root nothing is kept.
 */
export class ContactDirectoryStore extends DeviceSealedRowStore<Row> {
  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-contact-directory'),
  ) {
    super(databaseName, 'pigeon-contact-directory', 'Contact directory');
  }

  /** The contacts last stored for this identity. Rejects on failure. */
  public async contacts(
    session: Session,
  ): Promise<readonly ContactDirectoryEntry[]> {
    const rows = await this.load(session);

    return rows.find(({ id }) => id === 'contacts')?.contacts ?? [];
  }

  /** Stores the whole directory in place of the previous one. */
  public async replace(
    session: Session,
    contacts: readonly ContactDirectoryEntry[],
  ): Promise<void> {
    await this.save(session, { contacts, id: 'contacts' });
  }
}
