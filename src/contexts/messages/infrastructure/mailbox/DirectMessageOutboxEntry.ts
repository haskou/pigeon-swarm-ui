import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageOutboxRow } from './DirectMessageOutboxRow';
import type { DirectMessageOutboxState } from './DirectMessageOutboxState';

import { DirectMessageOutboxSettlement } from './DirectMessageOutboxSettlement';

/** An absent peer inbox is retried quickly for this long, then slowly. */
const FAST_RETRY_WINDOW_MS = 30_000;
const FIRST_RETRY_MS = 250;
const FAST_RETRY_CAP_MS = 4_000;
const SLOW_RETRY_MS = 60_000;

/** The in-memory state of one queued send. */
export class DirectMessageOutboxEntry {
  private attempt = 0;
  private cancelledFlag = false;
  private currentRow: DirectMessageOutboxRow;
  private currentState: DirectMessageOutboxState;
  private settlement = new DirectMessageOutboxSettlement();
  private startedAt = Date.now();
  public readonly identityId: string;

  public constructor(
    public readonly session: Session,
    row: DirectMessageOutboxRow,
  ) {
    this.identityId = session.identity.id;
    this.currentRow = row;
    this.currentState = row.state === 'failed' ? 'failed' : 'pending';
  }

  public get cancelled(): boolean {
    return this.cancelledFlag;
  }

  public get row(): DirectMessageOutboxRow {
    return this.currentRow;
  }

  public get settled(): DirectMessageOutboxSettlement {
    return this.settlement;
  }

  public get state(): DirectMessageOutboxState {
    return this.currentState;
  }

  public cancel(): void {
    this.cancelledFlag = true;
  }

  /**
   * The wait before the next peer attempt: 250 ms doubling to 4 s within the
   * first 30 s, then 60 s. Counts the attempt.
   */
  public nextRetryDelayMs(): number {
    const elapsedMs = Date.now() - this.startedAt;
    const delayMs =
      elapsedMs >= FAST_RETRY_WINDOW_MS
        ? SLOW_RETRY_MS
        : Math.min(FIRST_RETRY_MS * 2 ** this.attempt, FAST_RETRY_CAP_MS);

    this.attempt += 1;

    return delayMs;
  }

  public replaceRow(row: DirectMessageOutboxRow): void {
    this.currentRow = row;
  }

  /** Starts a new delivery run after a failure, with a fresh ticket. */
  public restart(): void {
    this.settlement = new DirectMessageOutboxSettlement();
    this.attempt = 0;
    this.startedAt = Date.now();
    this.currentState = 'pending';
    this.currentRow = { ...this.currentRow, state: 'pending' };
  }

  /** Whether the state changed. */
  public transition(state: DirectMessageOutboxState): boolean {
    if (this.currentState === state) return false;

    this.currentState = state;

    return true;
  }
}
