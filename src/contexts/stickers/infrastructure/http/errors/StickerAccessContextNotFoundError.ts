export class StickerAccessContextNotFoundError extends Error {
  public constructor() {
    super('Sticker access context is not registered.');
  }
}
