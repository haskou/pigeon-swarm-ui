import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import {
  CommunityListNotSettledError,
  readCommunitiesUntilSettled,
} from '../../../../../contexts/communities/presentation/hooks/readCommunitiesUntilSettled';

const community = { id: 'community-1' } as never;
const delaysMs = [1, 1, 1];

function notReady(): HttpJsonError {
  return new HttpJsonError('replicated state not ready', 503, '503020');
}

describe('readCommunitiesUntilSettled', () => {
  it('answers a new user with an empty list at once, without a second read', async () => {
    const read = jest.fn().mockResolvedValue([]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('answers a non-empty list at once for a device that had communities', async () => {
    const read = jest.fn().mockResolvedValue([community]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).resolves.toEqual([community]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again while a device that had communities is told the list is empty', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([community]);
    const waiting = jest.fn();

    await expect(
      readCommunitiesUntilSettled({
        delaysMs,
        hadCommunities: true,
        onWaiting: waiting,
        read,
      }),
    ).resolves.toEqual([community]);
    expect(read).toHaveBeenCalledTimes(3);
    expect(waiting).toHaveBeenCalled();
  });

  it('never reports an empty list for a device that had communities once the budget is spent', async () => {
    const read = jest.fn().mockResolvedValue([]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toBeInstanceOf(CommunityListNotSettledError);
    expect(read).toHaveBeenCalledTimes(delaysMs.length + 1);
  });

  it('keeps reading past the 503020 answer of a node whose state is not ready', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(notReady())
      .mockRejectedValueOnce(notReady())
      .mockResolvedValueOnce([community]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).resolves.toEqual([community]);
  });

  it('throws the 503020 failure when the budget is spent, never an empty list', async () => {
    const read = jest.fn().mockRejectedValue(notReady());

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).rejects.toBeInstanceOf(HttpJsonError);
  });

  it('does not retry other failures', async () => {
    const read = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toThrow('offline');
    expect(read).toHaveBeenCalledTimes(1);
  });
});
