import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealingRecordRequest } from './PigeonCallSealingApi';

import { CallSignalSigningBytes } from './CallSignalSigningBytes';

const DAY_MS = 86_400_000;

type SealingKeys = { publicKey(session: Session): Promise<string> };
type RecordSink = {
  publishRecord(
    session: Session,
    record: DeviceSealingRecordRequest,
  ): Promise<void>;
};

/**
 * Publishes this device's signed sealing record for the UTC day D and for
 * D-1, so a sender whose clock lags a day still seals to a key this device
 * holds. Each day is published once per page load; the node treats a repeat
 * as a no-op.
 */
export class DeviceSealingRecordPublisher {
  private readonly published = new Set<string>();

  public constructor(
    private readonly keys: SealingKeys,
    private readonly sink: RecordSink,
    private readonly clock: () => number,
  ) {}

  private static day(at: number): string {
    return new Date(at).toISOString().slice(0, 10);
  }

  public async publish(session: Session): Promise<void> {
    const now = this.clock();
    const sealingPublicKey = await this.keys.publicKey(session);
    const { publicKey: deviceCredential } =
      session.deviceCredentialKeyPair.toPrimitives();

    for (const utcDay of [
      DeviceSealingRecordPublisher.day(now),
      DeviceSealingRecordPublisher.day(now - DAY_MS),
    ]) {
      const marker = `${session.identity.id}|${deviceCredential}|${utcDay}|${sealingPublicKey}`;

      if (this.published.has(marker)) continue;

      const signature = session.deviceCredentialKeyPair
        .sign(
          CallSignalSigningBytes.sealingRecord({
            deviceCredential,
            identityId: session.identity.id,
            sealingPublicKey,
            utcDay,
          }),
        )
        .valueOf();

      await this.sink.publishRecord(session, {
        deviceCredential,
        sealingPublicKey,
        signature,
        utcDay,
      });
      this.published.add(marker);
    }
  }
}
