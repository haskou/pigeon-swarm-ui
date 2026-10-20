import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../identities/domain/DeviceAuthorizationTransitionLogPrimitives';
import type { Session } from '../../../identities/infrastructure/session/Session';

type LogReader = {
  transitions(
    session: Session,
    identityId: string,
  ): Promise<DeviceAuthorizationTransitionLogPrimitives>;
};

/**
 * The transition logs of one identity from independent origins: this
 * device's own node and the identity's verified mailbox home. An origin that
 * is the same node, unverified, or unreachable contributes nothing, so a
 * verifier asking for two replicas refuses when only one is available.
 */
export class CallSignalReplicaLogs {
  public constructor(
    private readonly own: LogReader,
    private readonly ownBase: () => string | undefined,
    private readonly verifiedHome: (
      identityId: string,
    ) => Promise<string | undefined>,
    private readonly remote: (base: string) => LogReader,
  ) {}

  public async logs(
    session: Session,
    identityId: string,
  ): Promise<DeviceAuthorizationTransitionLogPrimitives[]> {
    const home = await this.verifiedHome(identityId).catch(() => undefined);
    const readers = [
      this.own,
      ...(home && home !== this.ownBase() ? [this.remote(home)] : []),
    ];
    const settled = await Promise.allSettled(
      readers.map((reader) => reader.transitions(session, identityId)),
    );

    return settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
  }
}
