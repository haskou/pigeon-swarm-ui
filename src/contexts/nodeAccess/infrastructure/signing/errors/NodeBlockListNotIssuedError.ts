export class NodeBlockListNotIssuedError extends Error {
  public constructor() {
    super('Only an issued block list version can be signed.');
    this.name = NodeBlockListNotIssuedError.name;
  }
}
