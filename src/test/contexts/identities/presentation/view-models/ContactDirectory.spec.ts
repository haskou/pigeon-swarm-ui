import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import { ContactDirectory } from '../../../../../contexts/identities/presentation/view-models/ContactDirectory';

function identity(
  id: string,
  name: string,
  handle?: string,
): IdentityResource {
  return { id, profile: { handle, name } } as IdentityResource;
}

describe(ContactDirectory.name, () => {
  it('remembers the display name of resolved contacts, newest first', () => {
    const directory = ContactDirectory.of([])
      .remember({ ada: identity('ada', 'Ada') }, 1)
      .remember({ grace: identity('grace', '', 'grace_h') }, 2);

    expect(directory.entries()).toEqual([
      { identityId: 'grace', name: '@grace_h', seenAt: 2 },
      { identityId: 'ada', name: 'Ada', seenAt: 1 },
    ]);
  });

  it('replaces a stored name with the live profile and keeps contacts not seen again', () => {
    const directory = ContactDirectory.of([
      { identityId: 'ada', name: 'Old Ada', seenAt: 1 },
      { identityId: 'grace', name: 'Grace', seenAt: 2 },
    ]).remember({ ada: identity('ada', 'Ada Lovelace') }, 3);

    expect(directory.entries()).toEqual([
      { identityId: 'ada', name: 'Ada Lovelace', seenAt: 3 },
      { identityId: 'grace', name: 'Grace', seenAt: 2 },
    ]);
  });

  it('keys contacts by the id the workspace knows them by', () => {
    expect(
      ContactDirectory.of([])
        .remember({ 'bare-ada': identity('pem-ada', 'Ada') }, 1)
        .entries(),
    ).toEqual([{ identityId: 'bare-ada', name: 'Ada', seenAt: 1 }]);
  });

  it('skips profiles with neither a name nor a handle', () => {
    expect(
      ContactDirectory.of([])
        .remember({ anonymous: identity('anonymous', ' ') }, 1)
        .entries(),
    ).toEqual([]);
  });

  it(`keeps only the ${ContactDirectory.LIMIT} most recently seen contacts`, () => {
    const identities = Array.from(
      { length: ContactDirectory.LIMIT + 2 },
      (_, index) => identity(`contact-${index}`, `Contact ${index}`),
    );
    const entries = identities
      .reduce(
        (directory, contact, index) =>
          directory.remember({ [contact.id]: contact }, index),
        ContactDirectory.of([]),
      )
      .entries();

    expect(entries).toHaveLength(ContactDirectory.LIMIT);
    expect(entries[0]?.identityId).toBe(`contact-${ContactDirectory.LIMIT + 1}`);
    expect(entries.map(({ identityId }) => identityId)).not.toContain(
      'contact-0',
    );
  });

  it('names contacts the node has not resolved yet and never overrides a live name', () => {
    const directory = ContactDirectory.of([
      { identityId: 'ada', name: 'Ada', seenAt: 1 },
      { identityId: 'grace', name: 'Old Grace', seenAt: 1 },
      { identityId: 'linus', name: 'Linus', seenAt: 1 },
    ]);

    expect(
      directory.knownNames({ ada: 'ada', grace: 'Grace Hopper', self: 'Me' }),
    ).toEqual({
      ada: 'Ada',
      grace: 'Grace Hopper',
      linus: 'Linus',
      self: 'Me',
    });
  });

  it('reports whether it holds the same contacts as another directory', () => {
    const directory = ContactDirectory.of([
      { identityId: 'ada', name: 'Ada', seenAt: 1 },
    ]);

    expect(directory.isSameAs(ContactDirectory.of(directory.entries()))).toBe(
      true,
    );
    expect(
      directory.isSameAs(directory.remember({ ada: identity('ada', 'Ada') }, 2)),
    ).toBe(false);
  });
});
