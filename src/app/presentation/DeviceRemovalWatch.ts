import type { Session } from '../../contexts/identities/infrastructure/session/Session';
import type { DeviceRemovalWatchListener } from './DeviceRemovalWatchListener';

import { DeviceRemovedError } from '../../contexts/identities/domain/DeviceRemovedError';

/**
 * Re-reads the signed device transitions of the signed-in session every
 * CHECK_INTERVAL_MS, so a revoke made on another device is noticed within that
 * bound plus one read, without waiting for the next sign-in. Only a removal
 * the transition log proves, replayed from the identity genesis, is reported.
 * A node message, a refused or failed read, or a log that proves nothing is
 * never a removal: the next check reads again.
 */
export class DeviceRemovalWatch {
  public static readonly CHECK_INTERVAL_MS = 30_000;

  private checking = false;

  private stopped = false;

  private cancelTimer: () => void = () => undefined;

  public constructor(
    private readonly currentSession: () => Session | null,
    private readonly synchronize: (session: Session) => Promise<Session>,
    private readonly listener: DeviceRemovalWatchListener,
  ) {}

  private async check(): Promise<void> {
    const session = this.currentSession();

    if (this.checking || this.stopped || !session) return;

    this.checking = true;

    try {
      this.advance(session, await this.synchronize(session));
    } catch (error) {
      this.remove(session, error);
    } finally {
      this.checking = false;
    }
  }

  private advance(session: Session, synchronized: Session): void {
    const advanced = !synchronized.authorizationRevision.isEqual(
      session.authorizationRevision,
    );

    if (advanced && !this.stopped) {
      this.listener.onAdvanced(session, synchronized);
    }
  }

  private remove(session: Session, error: unknown): void {
    if (!(error instanceof DeviceRemovedError) || this.stopped) return;

    this.stop();
    this.listener.onRemoved(session.identity.id);
  }

  public start(): void {
    const timer = setInterval(() => {
      void this.check();
    }, DeviceRemovalWatch.CHECK_INTERVAL_MS);

    this.cancelTimer = () => clearInterval(timer);
  }

  public stop(): void {
    this.stopped = true;
    this.cancelTimer();
  }
}
