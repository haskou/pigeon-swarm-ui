import {
  clearCommunityInviteUrl,
  createCommunityInviteUrl,
  parseCommunityInviteUrl,
} from '../../../../../contexts/communities/presentation/view-models/communityInviteLink';

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

function installLocation(
  href: string,
  stored: Map<string, string> = new Map(),
): { replacedUrls: string[]; stored: Map<string, string> } {
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
      sessionStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        removeItem: (key: string) => stored.delete(key),
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    },
  });

  return { replacedUrls, stored };
}

describe('community invitation links', () => {
  afterEach(() => {
    restoreGlobalProperty('document', originalDocument);
    restoreGlobalProperty('window', originalWindow);
  });

  it('creates one link carrying the community and secret in the fragment', () => {
    installLocation('https://pigeon.example/messages?old=1#stale');

    expect(
      createCommunityInviteUrl({ communityId: 'community-1', secret: 'sec_1' }),
    ).toBe('https://pigeon.example/invite/community#c=community-1&k=sec_1');
  });

  it('parses the fragment and strips it from the address bar immediately', () => {
    const { replacedUrls } = installLocation(
      'https://pigeon.example/invite/community#c=community-1&k=sec_1',
    );

    expect(parseCommunityInviteUrl()).toEqual({
      communityId: 'community-1',
      secret: 'sec_1',
    });
    expect(replacedUrls).toEqual(['https://pigeon.example/']);
  });

  it('keeps the parsed invitation for the session after the fragment is gone', () => {
    const first = installLocation(
      'https://pigeon.example/invite/community#c=community-1&k=sec_1',
    );

    parseCommunityInviteUrl();
    installLocation('https://pigeon.example/', first.stored);

    expect(parseCommunityInviteUrl()).toEqual({
      communityId: 'community-1',
      secret: 'sec_1',
    });
  });

  it('ignores links missing the community or the secret', () => {
    installLocation('https://pigeon.example/invite/community#c=community-1');

    expect(parseCommunityInviteUrl()).toBeNull();
  });

  it('forgets the stored invitation when cleared', () => {
    const { stored } = installLocation(
      'https://pigeon.example/invite/community#c=community-1&k=sec_1',
    );

    parseCommunityInviteUrl();
    clearCommunityInviteUrl();

    expect(stored.size).toBe(0);
  });
});
