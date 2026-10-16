import type { CallMediaFrameOpener } from '@haskou/pigeon-swarm-crypto';

/** One member's opener and the keys queued for it. */
export type KeyedOpener = {
  readonly opener: CallMediaFrameOpener;
  /** Settles once every key handed to the opener so far is added. */
  keys: Promise<void>;
};
