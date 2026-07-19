export class StickerAdditionNotRecordedError extends Error {
  public constructor() {
    super('The sticker pack has no recorded sticker addition.');
  }
}
