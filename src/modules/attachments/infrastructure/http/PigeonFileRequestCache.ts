export class PigeonFileRequestCache<T> {
  private readonly requests = new Map<string, Promise<T>>();

  public async getOrCreate(
    key: string,
    requestFactory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.requests.get(key);

    if (cached) return await cached;

    const request = requestFactory().catch((caught: unknown) => {
      this.requests.delete(key);

      throw caught;
    });

    this.requests.set(key, request);

    return await request;
  }
}
