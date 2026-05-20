export class ListStickerPacksMessage {
  public constructor(
    private readonly input: {
      ownerIdentityId?: string;
    } = {},
  ) {}

  public getOwnerIdentityId(): string | undefined {
    return this.input.ownerIdentityId;
  }
}
