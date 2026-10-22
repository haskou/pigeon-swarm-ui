import {
  forgetCommunitiesSeen,
  hasSeenCommunities,
  rememberCommunitiesSeen,
} from '../../../../../contexts/communities/infrastructure/storage/communitiesSeen';
import { CommunityListLoads } from '../../../../../contexts/communities/presentation/hooks/CommunityListLoads';
import { loadCommunityList } from '../../../../../contexts/communities/presentation/hooks/loadCommunityList';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const community = { id: 'community-1' } as never;

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function sinks(): {
  onFailed: jest.Mock;
  onSettled: jest.Mock;
  onUnsettled: jest.Mock;
  onWaiting: jest.Mock;
} {
  return {
    onFailed: jest.fn(),
    onSettled: jest.fn(),
    onUnsettled: jest.fn(),
    onWaiting: jest.fn(),
  };
}

describe('loadCommunityList', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('settles the list and remembers that the identity has communities', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();

    await loadCommunityList({
      ...out,
      delaysMs: [1],
      load: loads.begin('identity-a'),
      read: jest.fn().mockResolvedValue([community]),
    });

    expect(out.onSettled).toHaveBeenCalledWith([community]);
    expect(hasSeenCommunities('identity-a')).toBe(true);
  });

  it('stops reading and writing nothing once the load is cancelled', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();

    rememberCommunitiesSeen('identity-a');
    const read = jest.fn().mockImplementation(() => {
      loads.cancel();

      return Promise.resolve([]);
    });

    await loadCommunityList({
      ...out,
      delaysMs: [1, 1, 1],
      load: loads.begin('identity-a'),
      read,
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(out.onSettled).not.toHaveBeenCalled();
    expect(out.onFailed).not.toHaveBeenCalled();
  });

  it('never writes the list of an identity the session switched away from', async () => {
    const loads = new CommunityListLoads();
    const slow = deferred<unknown[]>();
    const outA = sinks();
    const outB = sinks();
    const loadA = loadCommunityList({
      ...outA,
      delaysMs: [1],
      load: loads.begin('identity-a'),
      read: jest.fn().mockReturnValue(slow.promise),
    });
    const loadB = loadCommunityList({
      ...outB,
      delaysMs: [1],
      load: loads.begin('identity-b'),
      read: jest.fn().mockResolvedValue([]),
    });

    slow.resolve([community]);
    await Promise.all([loadA, loadB]);

    expect(outA.onSettled).not.toHaveBeenCalled();
    expect(outA.onFailed).not.toHaveBeenCalled();
    expect(hasSeenCommunities('identity-a')).toBe(false);
    expect(outB.onSettled).toHaveBeenCalledWith([]);
  });

  it('leaves no flag when the device was erased while the list was loading', async () => {
    const loads = new CommunityListLoads();
    const slow = deferred<unknown[]>();
    const out = sinks();
    const loading = loadCommunityList({
      ...out,
      delaysMs: [1],
      load: loads.begin('identity-a'),
      read: jest.fn().mockReturnValue(slow.promise),
    });

    loads.cancel();
    slow.resolve([community]);
    await loading;

    expect(hasSeenCommunities('identity-a')).toBe(false);
    expect(out.onSettled).not.toHaveBeenCalled();
  });

  it('runs one loop however often a reload is started', async () => {
    const loads = new CommunityListLoads();

    rememberCommunitiesSeen('identity-a');
    const reads = [jest.fn(), jest.fn(), jest.fn()];
    const outs = [sinks(), sinks(), sinks()];

    for (const read of reads) read.mockResolvedValue([]);
    const loading = reads.map(
      async (read, index) =>
        await loadCommunityList({
          ...outs[index],
          delaysMs: [1, 1],
          load: loads.begin('identity-a'),
          read,
        }),
    );

    await Promise.all(loading);

    expect(reads[0]).toHaveBeenCalledTimes(1);
    expect(reads[1]).toHaveBeenCalledTimes(1);
    expect(reads[2]).toHaveBeenCalledTimes(3);
    expect(outs[0].onUnsettled).not.toHaveBeenCalled();
    expect(outs[1].onUnsettled).not.toHaveBeenCalled();
    expect(outs[2].onUnsettled).toHaveBeenCalledTimes(1);
    expect(outs[2].onFailed).not.toHaveBeenCalled();
  });

  it('offers to go on without communities when the node keeps answering an empty list, and keeps the flag', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();

    rememberCommunitiesSeen('identity-a');

    await loadCommunityList({
      ...out,
      delaysMs: [1, 1],
      load: loads.begin('identity-a'),
      read: jest.fn().mockResolvedValue([]),
    });

    expect(out.onUnsettled).toHaveBeenCalledTimes(1);
    expect(out.onFailed).not.toHaveBeenCalled();
    expect(out.onSettled).not.toHaveBeenCalled();
    expect(hasSeenCommunities('identity-a')).toBe(true);
  });

  it('never offers to go on without communities when the node is not ready', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();

    rememberCommunitiesSeen('identity-a');

    await loadCommunityList({
      ...out,
      delaysMs: [1],
      load: loads.begin('identity-a'),
      read: jest
        .fn()
        .mockRejectedValue(
          new HttpJsonError(
            503,
            'Service Unavailable',
            JSON.stringify({ code: 503020 }),
          ),
        ),
    });

    expect(out.onFailed).toHaveBeenCalledWith(expect.any(HttpJsonError));
    expect(out.onUnsettled).not.toHaveBeenCalled();
    expect(hasSeenCommunities('identity-a')).toBe(true);
  });

  it('settles an empty list with one read once the user went on without communities', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();
    const read = jest.fn().mockResolvedValue([]);

    rememberCommunitiesSeen('identity-a');
    forgetCommunitiesSeen('identity-a');

    await loadCommunityList({
      ...out,
      delaysMs: [1, 1],
      load: loads.begin('identity-a'),
      read,
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(out.onSettled).toHaveBeenCalledWith([]);
    expect(out.onUnsettled).not.toHaveBeenCalled();
  });

  it('reports a failed load only while it is the current one', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();

    await loadCommunityList({
      ...out,
      delaysMs: [],
      load: loads.begin('identity-a'),
      read: jest.fn().mockRejectedValue(new Error('offline')),
    });

    expect(out.onFailed).toHaveBeenCalledWith(expect.any(Error));
  });

  it('starts no read for a load that was cancelled before it began', async () => {
    const loads = new CommunityListLoads();
    const out = sinks();
    const read = jest.fn().mockResolvedValue([community]);
    const load = loads.begin('identity-a');

    loads.cancel();
    await loadCommunityList({ ...out, delaysMs: [1], load, read });

    expect(read).not.toHaveBeenCalled();
    expect(out.onSettled).not.toHaveBeenCalled();
    expect(out.onFailed).not.toHaveBeenCalled();
  });
});
