export class PrivateBlobUploadIncompleteError extends Error {
  public constructor() {
    super('Private blob upload is incomplete.');
    this.name = PrivateBlobUploadIncompleteError.name;
  }
}
