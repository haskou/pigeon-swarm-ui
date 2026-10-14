import type { ContactDirectoryRepository as Repository } from '../../domain/repositories/ContactDirectoryRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { ContactDirectoryStore } from './ContactDirectoryStore';

/** The sealed contact directory of this device. */
export class SealedContactDirectoryRepository implements Repository {
  public constructor(private readonly store: ContactDirectoryStore) {}

  /** Never throws; the store logs one count-only line on failure. */
  public async forget(identityId: IdentityId): Promise<void> {
    await this.store.forget(identityId.toString());
  }
}
