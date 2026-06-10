import type { Community } from '../../domain/Community';

export class CommunityList {
  public static withUniqueIds(communities: Community[]): Community[] {
    const seenIds = new Set<string>();
    const uniqueCommunities: Community[] = [];

    for (const community of communities) {
      if (seenIds.has(community.id)) continue;

      seenIds.add(community.id);
      uniqueCommunities.push(community);
    }

    return uniqueCommunities.length === communities.length
      ? communities
      : uniqueCommunities;
  }
}
