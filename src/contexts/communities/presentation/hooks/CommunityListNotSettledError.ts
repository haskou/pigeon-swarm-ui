export class CommunityListNotSettledError extends Error {
  public constructor() {
    super('The node has not settled its community list yet.');
    this.name = CommunityListNotSettledError.name;
  }
}
