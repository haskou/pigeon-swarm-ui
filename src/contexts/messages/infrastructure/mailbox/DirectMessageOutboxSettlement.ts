/** The outcome of one delivery run of a queued send, exposed as a ticket. */
export class DirectMessageOutboxSettlement {
  private rejectPromise!: (reason?: unknown) => void;
  private resolvePromise!: () => void;
  public readonly promise: Promise<void>;

  public constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolvePromise = () => resolve();
      this.rejectPromise = (reason) => reject(reason);
    });

    // A rejected ticket is handled by its caller; this only avoids an
    // unhandled rejection when nobody holds the ticket.
    this.promise.catch(() => undefined);
  }

  public reject(reason?: unknown): void {
    this.rejectPromise(reason);
  }

  public resolve(): void {
    this.resolvePromise();
  }
}
