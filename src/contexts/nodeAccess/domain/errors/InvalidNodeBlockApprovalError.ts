export class InvalidNodeBlockApprovalError extends Error {
  public constructor() {
    super('Approve all entries or name at least one entry.');
    this.name = InvalidNodeBlockApprovalError.name;
  }
}
