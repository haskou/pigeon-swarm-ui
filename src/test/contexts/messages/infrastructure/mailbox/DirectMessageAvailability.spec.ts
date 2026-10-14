import { describe, expect, it, jest } from '@jest/globals';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageAvailabilityServer } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAvailabilityServer';
import type { DirectMessageAvailabilityStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAvailabilityStore';
import type { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';

import { DirectMessageAvailability } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAvailability';

jest.mock(
  '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageInboxKeys',
  () => ({ DirectMessageInboxKeys: {} }),
);

const OWN_ID = 'MCowBQYDK2VwAyEAown';
const session = { identity: { id: OWN_ID } } as unknown as Session;

const availability = () =>
  new DirectMessageAvailability(
    [{ base: 'https://own.example' } as DirectMessageAvailabilityServer],
    { send: jest.fn<RecipientMailboxRouter['send']>() },
    {
      servers: () => ['https://peer.example'],
    } as unknown as DirectMessageAvailabilityStore,
  );

describe(DirectMessageAvailability.name, () => {
  it('uses own servers for an own copy addressed with the own id in PEM form', () => {
    expect(
      availability().serversFor(
        session,
        `-----BEGIN PUBLIC KEY-----\n${OWN_ID}\n-----END PUBLIC KEY-----\n`,
        'mailbox-1',
      ),
    ).toEqual(['https://own.example']);
  });

  it('uses the servers the peer announced for a peer copy', () => {
    expect(
      availability().serversFor(session, 'MCowBQYDK2VwAyEApeer', 'mailbox-1'),
    ).toEqual(['https://peer.example']);
  });

  it('uses the peer servers for a recipient id the value object rejects', () => {
    expect(
      availability().serversFor(session, 'x'.repeat(5000), 'mailbox-1'),
    ).toEqual(['https://peer.example']);
  });
});
