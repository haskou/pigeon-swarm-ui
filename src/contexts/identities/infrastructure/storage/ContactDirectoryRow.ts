import type { ContactDirectoryEntry } from './ContactDirectoryEntry';

/**
 * The whole contact directory of one identity as a single sealed row, so no
 * contact id appears as a storage key at rest.
 */
export type ContactDirectoryRow = {
  readonly contacts: readonly ContactDirectoryEntry[];
  readonly id: 'contacts';
};
