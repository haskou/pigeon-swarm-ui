export class StickerProjectionNotFoundError extends Error {
  public constructor() {
    super('Persisted sticker projection was not returned.');
  }
}
