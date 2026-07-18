export class PushSubscriptionExpiration {
  public static fromPrimitives(
    expirationTime?: number | null,
  ): PushSubscriptionExpiration {
    return new PushSubscriptionExpiration(expirationTime);
  }

  private constructor(private readonly expirationTime?: number | null) {}

  public toPrimitives(): number | null | undefined {
    return this.expirationTime;
  }
}
