export class InvalidNodeBlockListVersionError extends Error {
  public constructor() {
    super('Block list versions must be positive safe integers.');
    this.name = InvalidNodeBlockListVersionError.name;
  }
}
