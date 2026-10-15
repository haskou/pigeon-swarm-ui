import {
  captureRegistrationLink,
  createRegistrationUrl,
  forgetRegistrationLink,
  pendingRegistrationLink,
} from '../../../../../contexts/nodeAccess/presentation/view-models/registrationLink';

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

const code = 'Q29kZUNvZGVDb2RlQ29kZUNvZGVDb2RlQ29kZUNvZGU';

describe('registration links', () => {
  afterEach(() => {
    forgetRegistrationLink();
    restoreGlobalProperty('document', originalDocument);
    restoreGlobalProperty('window', originalWindow);
  });

  it('keeps the normalized node and the code in the fragment of this UI origin', () => {
    installLocation('https://pigeon.example/messages?old=1#stale');

    expect(
      createRegistrationUrl({
        code,
        node: 'https://node.example/api/',
      }),
    ).toBe(
      `https://pigeon.example/register#node=https%3A%2F%2Fnode.example%2Fapi&code=${code}`,
    );
  });

  it('captures the link and clears the fragment at once', () => {
    const { replacedUrls } = installLocation(
      `https://pigeon.example/register#node=https%3A%2F%2Fnode.example%2Fapi&code=${code}`,
    );

    captureRegistrationLink();

    expect(pendingRegistrationLink()).toEqual({
      code,
      node: 'https://node.example/api',
    });
    expect(replacedUrls).toEqual(['/']);
  });

  it.each([
    ['another path', `https://pigeon.example/messages#node=https%3A%2F%2Fnode.example&code=${code}`],
    ['a short code', 'https://pigeon.example/register#node=https%3A%2F%2Fnode.example&code=abc'],
    ['an insecure node', `https://pigeon.example/register#node=http%3A%2F%2Fnode.example&code=${code}`],
    ['a missing node', `https://pigeon.example/register#code=${code}`],
    ['malformed encoding', `https://pigeon.example/register#node=%E0%A4%A&code=${code}`],
  ])('ignores a link with %s', (_case, href) => {
    installLocation(href);

    captureRegistrationLink();

    expect(pendingRegistrationLink()).toBeNull();
  });

  it('clears the fragment of a malformed registration link too', () => {
    const { replacedUrls } = installLocation(
      'https://pigeon.example/register#node=x&code=abc',
    );

    captureRegistrationLink();

    expect(replacedUrls).toEqual(['/']);
  });

  it('forgets the code once sign-up no longer needs it', () => {
    installLocation(
      `https://pigeon.example/register#node=https%3A%2F%2Fnode.example&code=${code}`,
    );
    captureRegistrationLink();

    forgetRegistrationLink();

    expect(pendingRegistrationLink()).toBeNull();
  });
});
