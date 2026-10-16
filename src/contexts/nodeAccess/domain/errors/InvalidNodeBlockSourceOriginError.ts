export class InvalidNodeBlockSourceOriginError extends Error {
  public constructor() {
    super('Block source origins must be https origins without a path.');
    this.name = InvalidNodeBlockSourceOriginError.name;
  }
}
