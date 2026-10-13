import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

const participantRetryDelayMs = 500;
const participantRetryLimit = 10;
const transientRetryBaseDelayMs = 500;
const transientRetryLimit = 3;

/**
 * Re-delivers a call signal while it is still current. A recipient that has
 * not joined yet is awaited at a steady pace. Timeouts, network failures,
 * throttling and server errors back off exponentially. Any other failure,
 * such as a rejected or unauthorised signal, is final.
 */
export class CallSignalRetry {
  private isTransient(error: unknown): boolean {
    if (error instanceof HttpJsonError)
      return error.status === 429 || error.status >= 500;

    if (error instanceof DOMException)
      return ['AbortError', 'TimeoutError'].includes(error.name);

    return error instanceof TypeError;
  }

  private retryDelay(error: unknown, attempt: number): number | undefined {
    if (
      error instanceof HttpJsonError &&
      error.status === 409 &&
      error.code === 'CallParticipantNotFoundError'
    )
      return attempt < participantRetryLimit
        ? participantRetryDelayMs
        : undefined;

    if (!this.isTransient(error) || attempt >= transientRetryLimit)
      return undefined;

    return transientRetryBaseDelayMs * 2 ** attempt;
  }

  public async send(
    deliver: () => Promise<void>,
    isCurrent: () => boolean,
  ): Promise<void> {
    for (let attempt = 0; isCurrent(); attempt++) {
      try {
        await deliver();

        return;
      } catch (error) {
        const delay = this.retryDelay(error, attempt);

        if (delay === undefined) throw error;

        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
