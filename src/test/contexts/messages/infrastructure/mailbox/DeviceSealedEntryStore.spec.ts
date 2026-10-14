import 'fake-indexeddb/auto';
import type * as BufferModule from 'buffer';

import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DeviceSealedEntryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';

// The browser bundle resolves `buffer` to the npm polyfill, whose `equals`
// accepts only its own Buffer. Node's built-in one also takes a Uint8Array.
jest.mock('buffer', () => jest.requireActual<typeof BufferModule>('buffer/'));

const KIND = 'kind-marker-3a90';
const ID = 'id-marker-8c1e';
const VALUE = new TextEncoder().encode('value-marker-e24b');

const root = (fill: number) => ({
  getBuffer: () => new Uint8Array(32).fill(fill),
});

const session = (current: number, previous?: number): Session =>
  ({
    deviceId: 'device-1',
    deviceSealedRootKey: root(current),
    identity: { id: 'alice' },
    previousDeviceSealedRootKey:
      previous === undefined ? undefined : root(previous),
  }) as unknown as Session;

describe('DeviceSealedEntryStore with the browser Buffer', () => {
  let name: string;

  beforeEach(() => {
    name = `device-sealed-entries-${randomUUID()}`;
  });

  it('re-seals the entries under the root that replaced the one they were sealed under', async () => {
    await new DeviceSealedEntryStore(name, 'label').put(
      session(1),
      KIND,
      ID,
      VALUE,
    );

    expect(
      await new DeviceSealedEntryStore(name, 'label').get(
        session(2, 1),
        KIND,
        ID,
      ),
    ).toEqual(VALUE);
    expect(
      await new DeviceSealedEntryStore(name, 'label').get(session(2), KIND, ID),
    ).toEqual(VALUE);
  });

  it('adds an entry only while none is held under its id, across connections', async () => {
    const other = new TextEncoder().encode('other-value-marker-51d7');
    const added = await Promise.all([
      new DeviceSealedEntryStore(name, 'label').add(
        session(1),
        KIND,
        ID,
        VALUE,
      ),
      new DeviceSealedEntryStore(name, 'label').add(
        session(1),
        KIND,
        ID,
        other,
      ),
    ]);
    const held = await new DeviceSealedEntryStore(name, 'label').get(
      session(1),
      KIND,
      ID,
    );

    expect(added.filter(Boolean)).toHaveLength(1);
    expect(held).toEqual(added[0] ? VALUE : other);
  });
});
