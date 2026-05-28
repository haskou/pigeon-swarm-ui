import { getInitialLanguage, saveLanguage } from './language';

describe('i18n language selection', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
      return;
    }

    Reflect.deleteProperty(globalThis, 'window');
  });

  it('defaults to Spanish with only a legacy saved preference', () => {
    const storage = fakeStorage([
      ['pigeon-swarm-language', 'en'],
    ]);
    defineWindow(storage);

    expect(getInitialLanguage()).toBe('es');
  });

  it('defaults to Spanish with an unconfirmed current saved preference', () => {
    const storage = fakeStorage([
      ['pigeon-swarm-language-v2', 'en'],
    ]);
    defineWindow(storage);

    expect(getInitialLanguage()).toBe('es');
  });

  it('defaults to Spanish with a stale explicit preference marker', () => {
    const storage = fakeStorage([
      ['pigeon-swarm-language-v2', 'en'],
      ['pigeon-swarm-language-explicit-v2', 'true'],
    ]);
    defineWindow(storage);

    expect(getInitialLanguage()).toBe('es');
    expect(storage.getItem('pigeon-swarm-language-v2')).toBeNull();
    expect(storage.getItem('pigeon-swarm-language-explicit-v2')).toBeNull();
  });

  it('uses the current saved preference when explicitly selected', () => {
    const storage = fakeStorage([
      ['pigeon-swarm-language-v2', 'en'],
      ['pigeon-swarm-language-explicit-v3', 'true'],
    ]);
    defineWindow(storage);

    expect(getInitialLanguage()).toBe('en');
  });

  it('saves preferences in the current language slot', () => {
    const storage = fakeStorage();
    defineWindow(storage);

    expect(saveLanguage('en')).toBe('en');
    expect(storage.getItem('pigeon-swarm-language-v2')).toBe('en');
    expect(storage.getItem('pigeon-swarm-language-explicit-v3')).toBe('true');
  });

  it('uses Spanish add-member dialog copy by default', async () => {
    const storage = fakeStorage();
    defineWindow(storage);
    jest.resetModules();

    const { copy } = await import('./copy');

    expect(copy.communities.addMemberFindIdentity).toBe('Buscar identidad');
    expect(copy.communities.addMemberCreateInviteLink).toBe(
      'Crear enlace de invitacion',
    );
    expect(copy.communities.linkHelp).toBe(
      'Crea un enlace de un solo uso. La clave de la comunidad se guarda en el fragmento de la URL y no se envia al servidor.',
    );
  });

  it('uses Spanish profile password helper copy by default', async () => {
    const storage = fakeStorage();
    defineWindow(storage);
    jest.resetModules();

    const { copy } = await import('./copy');

    expect(copy.profile.newPasswordHelp).toBe(
      'Deja ambos campos vacios para mantener tu contrasena actual.',
    );
  });

  it('uses Spanish sticker picker copy by default', async () => {
    const storage = fakeStorage();
    defineWindow(storage);
    jest.resetModules();

    const { copy } = await import('./copy');

    expect(copy.stickers.emoji).toBe('Emojis');
    expect(copy.stickers.manage).toBe('Gestionar');
    expect(copy.stickers.search).toBe('Buscar');
  });
});

function defineWindow(localStorage: Storage) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
    },
  });
}

function fakeStorage(entries: Array<[string, string]> = []): Storage {
  const values = new Map(entries);

  return {
    clear: jest.fn(() => values.clear()),
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    key: jest.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size;
    },
    removeItem: jest.fn((key: string) => values.delete(key)),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
  } as Storage;
}
