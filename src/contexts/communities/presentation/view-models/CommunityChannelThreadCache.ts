import type {
  CommunityChannelThreadSummary,
  CommunityTextChannel,
} from '../../../../shared/domain/pigeonResources.types';

type ChannelThreadsById = Record<string, CommunityChannelThreadSummary[]>;

type CacheEntry = {
  storedAt: number;
  threadsByChannelId: ChannelThreadsById;
};

const DEFAULT_TTL_MS = 15_000;

export class CommunityChannelThreadCache {
  private readonly entries = new Map<string, CacheEntry>();

  public constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  public static addLabelKeys(
    current: Set<string>,
    keys: string[],
  ): Set<string> {
    const missingKeys = keys.filter((key) => !current.has(key));

    return missingKeys.length === 0
      ? current
      : new Set([...current, ...missingKeys]);
  }

  public static fromChannels(
    channels: CommunityTextChannel[],
  ): ChannelThreadsById {
    return Object.fromEntries(
      channels.map((channel) => [channel.id, channel.threads ?? []]),
    );
  }

  public read(communityId: string): ChannelThreadsById | null {
    const entry = this.entries.get(communityId);

    if (!entry) return null;

    if (this.now() - entry.storedAt > this.ttlMs) {
      this.entries.delete(communityId);

      return null;
    }

    return entry.threadsByChannelId;
  }

  public write(
    communityId: string,
    threadsByChannelId: ChannelThreadsById,
  ): void {
    this.entries.set(communityId, {
      storedAt: this.now(),
      threadsByChannelId,
    });
  }
}
