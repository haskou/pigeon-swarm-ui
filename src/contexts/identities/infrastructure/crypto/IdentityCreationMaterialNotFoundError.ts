export class IdentityCreationMaterialNotFoundError extends Error {
  public constructor() {
    super('Identity creation material was not found.');
    this.name = 'IdentityCreationMaterialNotFoundError';
  }
}
