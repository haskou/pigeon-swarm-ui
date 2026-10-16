export class NodeBlockEntryNotBlockedError extends Error {
  public constructor() {
    super('This entry is not blocked.');
    this.name = NodeBlockEntryNotBlockedError.name;
  }
}
