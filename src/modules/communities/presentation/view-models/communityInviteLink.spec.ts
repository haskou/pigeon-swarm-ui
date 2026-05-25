import {
  clearCommunityInviteUrl,
  createCommunityInviteUrl,
  parseCommunityInviteUrl,
} from './communityInviteLink';

const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function restoreGlobalProperty(
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

function installLocation(href: string): { replacedUrls: string[] } {
  const replacedUrls: string[] = [];
  const location = new URL(href);

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { title: 'Pigeon Swarm' },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          replacedUrls.push(url);
        },
      },
      location,
    },
  });

  return { replacedUrls };
}

describe('community invite links', () => {
  afterEach(() => {
    restoreGlobalProperty('document', originalDocument);
    restoreGlobalProperty('window', originalWindow);
  });

  it('creates short invite links with the key secret in the URL fragment', () => {
    installLocation('https://pigeon.example/messages?old=1#stale');

    expect(
      createCommunityInviteUrl({
        inviteSecret: 'secret_123',
        token: 'invite/token',
      }),
    ).toBe(
      'https://pigeon.example/invite/community/invite%2Ftoken#k=secret_123',
    );
  });

  it('parses the short invite link format', () => {
    installLocation(
      'https://pigeon.example/invite/community/invite-token#k=secret_123',
    );

    expect(parseCommunityInviteUrl()).toEqual({
      inviteSecret: 'secret_123',
      token: 'invite-token',
    });
  });

  it('ignores short invite links with malformed path encoding', () => {
    installLocation('https://pigeon.example/invite/community/%E0%A4%A#k=secret');

    expect(parseCommunityInviteUrl()).toBeNull();
  });

  it('keeps parsing legacy invite links with embedded key entries', () => {
    installLocation(
      'https://pigeon.example/?communityInvite=legacy-token#communityKey=eyJjb252ZXJzYXRpb25JZCI6ImNvbW11bml0eS0xIiwiY3JlYXRlZEF0IjoxNzcsInBlZXJJZGVudGl0eUlkIjoiIiwicHJpdmF0ZUtleSI6InByaXZhdGUiLCJwdWJsaWNLZXkiOiJwdWJsaWMifQ',
    );

    expect(parseCommunityInviteUrl()).toEqual({
      keyEntry: {
        conversationId: 'community-1',
        createdAt: 177,
        peerIdentityId: '',
        privateKey: 'private',
        publicKey: 'public',
      },
      token: 'legacy-token',
    });
  });

  it('clears short invite links back to the app root', () => {
    const { replacedUrls } = installLocation(
      'https://pigeon.example/invite/community/invite-token#k=secret_123',
    );

    clearCommunityInviteUrl();

    expect(replacedUrls).toEqual(['https://pigeon.example/']);
  });
});
