export class NodeBlockSourceHasNothingPendingError extends Error {
  public constructor() {
    super('The followed block list has no pending entries to approve.');
    this.name = NodeBlockSourceHasNothingPendingError.name;
  }
}
