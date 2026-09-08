import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

export class CallSignalRetry {
  public async send(
    deliver: () => Promise<void>,
    isCurrent: () => boolean,
  ): Promise<void> {
    for (let attempt = 0; isCurrent(); attempt++) {
      try {
        await deliver();

        return;
      } catch (error) {
        if (
          !(error instanceof HttpJsonError) ||
          error.status !== 409 ||
          error.code !== 'CallParticipantNotFoundError' ||
          attempt >= 10
        )
          throw error;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }
}
