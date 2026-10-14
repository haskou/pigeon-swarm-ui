import type { IdentityResource } from '../../infrastructure/http/resources/IdentityResource';
import type { ContactDirectoryEntry } from '../../infrastructure/storage/ContactDirectoryEntry';

import { IdentityMatch } from '../../domain/IdentityMatch';
import { identityName, type IdentityNames } from './identityDisplay';

/**
 * The display names of contacts the node already returned, kept so they can
 * be read and searched while profile reads fail. It names identities and never
 * vouches for them: it holds no keys and no credentials. Keeps the most
 * recently seen contacts up to `LIMIT`.
 */
export class ContactDirectory {
  public static readonly LIMIT = 1000;

  public static of(
    entries: readonly ContactDirectoryEntry[],
  ): ContactDirectory {
    return new ContactDirectory(
      new Map(
        [...entries]
          .sort((left, right) => right.seenAt - left.seenAt)
          .slice(0, ContactDirectory.LIMIT)
          .map((entry) => [entry.identityId, entry]),
      ),
    );
  }

  private constructor(
    private readonly contacts: ReadonlyMap<string, ContactDirectoryEntry>,
  ) {}

  /** Newest first. */
  public entries(): ContactDirectoryEntry[] {
    return [...this.contacts.values()];
  }

  public isSameAs(other: ContactDirectory): boolean {
    return JSON.stringify(this.entries()) === JSON.stringify(other.entries());
  }

  /**
   * `names` with a stored name for every contact it does not name yet or
   * names only by its raw id. Live names win.
   */
  public knownNames(names: IdentityNames): IdentityNames {
    const known = { ...names };

    this.contacts.forEach(({ identityId, name }) => {
      if (!known[identityId] || known[identityId] === identityId) {
        known[identityId] = name;
      }
    });

    return known;
  }

  /**
   * Records the live profiles, keyed by the ids the workspace uses. The own
   * identity is not a contact, whichever form its id is keyed in.
   */
  public remember(
    profiles: Readonly<Record<string, IdentityResource>>,
    seenAt: number,
    ownIdentityId: string,
  ): ContactDirectory {
    const contacts = new Map(this.contacts);

    Object.entries(profiles).forEach(([identityId, profile]) => {
      const name = identityName(profile);

      if (name && !IdentityMatch.isSame(identityId, ownIdentityId))
        contacts.set(identityId, { identityId, name, seenAt });
    });

    return ContactDirectory.of([...contacts.values()]);
  }
}
