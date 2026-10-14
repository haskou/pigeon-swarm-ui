import { mock, mockDeep } from 'jest-mock-extended';

import type { ContactPresenceStorage } from '../../../../app/composition/identities/ContactPresenceStorage';
import type { IdentityUseCases } from '../../../../app/composition/identities/IdentityUseCases';
import type { IdentityMapper } from '../../../../contexts/identities/infrastructure/http/IdentityMapper';
import type { IdentityPresenceMapper } from '../../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import type { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ContactDirectoryStore } from '../../../../contexts/identities/infrastructure/storage/ContactDirectoryStore';

import { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import { Identity } from '../../../../contexts/identities/domain/Identity';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';

describe(PigeonIdentitiesFacade.name, () => {
  it('hydrates and orders the workspace after the use case unlocks identity', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const useCases = mockDeep<IdentityUseCases>();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const identity = Identity.fromPrimitives({
      createdAt: 100,
      id: 'identity-a',
      networkIds: [],
      profile: {
        banner: undefined,
        biography: undefined,
        handle: undefined,
        name: 'Ada',
        picture: undefined,
      },
    });

    contexts.register(session);
    useCases.login.login.mockResolvedValue(identity);
    gateway.hydrateSession.mockResolvedValue({
      conversations: [
        {
          adminIds: [],
          id: 'older',
          latestMessageAt: 1,
          networkId: 'network-a',
          participantIds: ['identity-a'],
          type: 'one-to-one',
        },
        {
          adminIds: [],
          id: 'newer',
          latestMessageAt: 2,
          networkId: 'network-a',
          participantIds: ['identity-a'],
          type: 'one-to-one',
        },
      ],
      session,
    });

    const result = await new PigeonIdentitiesFacade(
      gateway,
      contexts,
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      useCases,
      mock<ContactDirectoryStore>(),
      mockDeep<ContactPresenceStorage>(),
    ).login('identity-a', 'Correct-Horse-Battery-9!');

    expect(result.conversations.map(({ id }) => id)).toEqual([
      'newer',
      'older',
    ]);
    expect(gateway.hydrateSession).toHaveBeenCalledWith(session, undefined);
  });

  it('hydrates the canonical unlocked identity when login uses a handle', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const useCases = mockDeep<IdentityUseCases>();
    const session = {
      identity: { id: 'canonical-identity' },
    } as unknown as Session;
    const identity = Identity.fromPrimitives({
      createdAt: 100,
      id: 'canonical-identity',
      networkIds: [],
      profile: {
        banner: undefined,
        biography: undefined,
        handle: 'ada',
        name: 'Ada',
        picture: undefined,
      },
    });

    contexts.register(session);
    useCases.login.login.mockResolvedValue(identity);
    gateway.hydrateSession.mockResolvedValue({ conversations: [], session });

    await new PigeonIdentitiesFacade(
      gateway,
      contexts,
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      useCases,
      mock<ContactDirectoryStore>(),
      mockDeep<ContactPresenceStorage>(),
    ).login('@ada', 'Correct-Horse-Battery-9!');

    expect(gateway.hydrateSession).toHaveBeenCalledWith(session, undefined);
  });

  it('forgets the current device of the registered session through the use case', async () => {
    const contexts = new IdentityAccessContexts();
    const useCases = mockDeep<IdentityUseCases>();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    useCases.currentDeviceForgetter.forget.mockResolvedValue('only-device');

    const outcome = await new PigeonIdentitiesFacade(
      mock<PigeonIdentitiesGateway>(),
      contexts,
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      useCases,
      mock<ContactDirectoryStore>(),
      mockDeep<ContactPresenceStorage>(),
    ).forgetCurrentDevice(session, false);

    const [message] = useCases.currentDeviceForgetter.forget.mock.calls[0];

    expect(outcome).toBe('only-device');
    expect(contexts.find(message.getIdentityId()).session).toBe(session);
    expect(message.getAllowOnlyDevice()).toBe(false);
  });

  it('reads, stores and forgets the sealed contact directory of a session', async () => {
    const contacts = mock<ContactDirectoryStore>();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const entries = [{ identityId: 'identity-b', name: 'Grace', seenAt: 1 }];
    const facade = new PigeonIdentitiesFacade(
      mock<PigeonIdentitiesGateway>(),
      new IdentityAccessContexts(),
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      mockDeep<IdentityUseCases>(),
      contacts,
      mockDeep<ContactPresenceStorage>(),
    );

    contacts.contacts.mockResolvedValue(entries);
    contacts.replace.mockResolvedValue(undefined);
    contacts.forget.mockResolvedValue(undefined);

    await expect(facade.knownContacts(session)).resolves.toEqual(entries);
    await facade.rememberContacts(session, entries);
    await facade.forgetContacts('identity-a');

    expect(contacts.replace).toHaveBeenCalledWith(session, entries);
    expect(contacts.forget).toHaveBeenCalledWith('identity-a');
  });

  it('forgets the contact presence and the sharing choices of a removed identity', async () => {
    const contactPresence = mockDeep<ContactPresenceStorage>();

    contactPresence.sharings.forget.mockResolvedValue(undefined);

    await new PigeonIdentitiesFacade(
      mock<PigeonIdentitiesGateway>(),
      new IdentityAccessContexts(),
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      mockDeep<IdentityUseCases>(),
      mock<ContactDirectoryStore>(),
      contactPresence,
    ).forgetContactPresence('identity-a');

    expect(contactPresence.inboxes.forget).toHaveBeenCalledWith('identity-a');
    expect(contactPresence.sharings.forget).toHaveBeenCalledWith('identity-a');
  });

  it('cuts revoked readers off the presence inboxes under the rotated session', async () => {
    const contactPresence = mockDeep<ContactPresenceStorage>();
    const contexts = new IdentityAccessContexts();
    const session = { identity: { id: 'identity-a' } } as unknown as Session;

    contactPresence.inboxes.cutOffRevokedReaders.mockResolvedValue(undefined);

    await new PigeonIdentitiesFacade(
      mock<PigeonIdentitiesGateway>(),
      contexts,
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      mockDeep<IdentityUseCases>(),
      mock<ContactDirectoryStore>(),
      contactPresence,
    ).cutOffRevokedPresenceReaders(session);

    expect(contactPresence.inboxes.cutOffRevokedReaders).toHaveBeenCalledWith(
      session,
    );
    expect(contexts.find(IdentityId.fromString('identity-a')).session).toBe(
      session,
    );
  });
});
