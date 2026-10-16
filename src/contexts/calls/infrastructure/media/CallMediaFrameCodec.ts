import type { CallMediaFramePeer } from '@haskou/pigeon-swarm-crypto';

import {
  CallMediaFrameOpener,
  CallMediaFrameSealer,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { CallMediaTrack } from './CallMediaTrack';
import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';
import type { KeyedOpener } from './KeyedOpener';

/**
 * Seals the encoded frames this identity sends in a private call and opens
 * those of every other member, through the library's PSCE2 sealers and
 * openers. One sealer of the newest key epoch serves every sender; each
 * member gets one opener, shared by all of its receivers, so a replayed frame
 * or one moved to another track or member does not open. Every browser path
 * runs it, so members on different browsers hear each other.
 */
export class CallMediaFrameCodec {
  private epoch = -1;

  /** The newest epoch's call key, to key the opener of a member heard later. */
  private key: Uint8Array | null = null;

  private keyArrived: (() => void) | undefined;

  /** Settles once the first key arrives. */
  private readonly keyed: Promise<void>;

  private readonly openers = new Map<string, KeyedOpener>();

  /** The newest epoch's sealer; null before the first key and once disposed. */
  private sealer: null | Promise<CallMediaFrameSealer> = null;

  /** The view's bytes as an ArrayBuffer, copied only if it is a slice. */
  private static arrayBuffer(bytes: Uint8Array): ArrayBuffer {
    if (
      bytes.buffer instanceof ArrayBuffer &&
      bytes.byteOffset === 0 &&
      bytes.byteLength === bytes.buffer.byteLength
    )
      return bytes.buffer;

    return Uint8Array.from(bytes).buffer;
  }

  /** The call key of `rawKey`, overwriting the copy it decodes with zeros. */
  private static symmetricKey(rawKey: Uint8Array): SymmetricKey {
    const bytes = Buffer.from(rawKey);

    try {
      return SymmetricKey.fromBuffer(bytes);
    } finally {
      bytes.fill(0);
    }
  }

  /** The bytes of a base64 call key. */
  public static rawKey(base64Key: string): Uint8Array<ArrayBuffer> {
    const bytes = SymmetricKey.fromBase64(base64Key).getBuffer();

    try {
      return Uint8Array.from(bytes);
    } finally {
      bytes.fill(0);
    }
  }

  /** `call` names the call and this identity, the sender of its frames. */
  public constructor(private readonly call: CallMediaFramePeer) {
    this.keyed = new Promise((resolve) => {
      this.keyArrived = resolve;
    });
  }

  private addOpenerKey(
    entry: KeyedOpener,
    key: SymmetricKey,
    epoch: number,
  ): void {
    // eslint-disable-next-line no-param-reassign -- keys queue in epoch order
    entry.keys = entry.keys
      .then(() => entry.opener.addKey(key, epoch))
      .catch(() => undefined);
  }

  private openerOf(senderId: string): KeyedOpener {
    const known = this.openers.get(senderId);

    if (known) return known;

    const entry: KeyedOpener = {
      keys: Promise.resolve(),
      opener: CallMediaFrameOpener.create({
        callId: this.call.callId,
        senderId,
      }),
    };

    if (this.key) {
      this.addOpenerKey(
        entry,
        CallMediaFrameCodec.symmetricKey(this.key),
        this.epoch,
      );
    }

    this.openers.set(senderId, entry);

    return entry;
  }

  private async open(
    senderId: string,
    frame: Uint8Array,
    track: CallMediaTrack,
  ): Promise<Uint8Array> {
    const entry = this.openerOf(senderId);

    await this.keyed;
    await entry.keys;

    return entry.opener.open(frame, track);
  }

  private async seal(
    frame: Uint8Array,
    track: CallMediaTrack,
  ): Promise<Uint8Array> {
    await this.keyed;

    if (!this.sealer) throw new Error('The call media codec holds no key.');

    return (await this.sealer).seal(frame, track);
  }

  /**
   * Takes the raw call key of `epoch`, which it owns from now on: a newer
   * epoch gets a new sealer and joins every opener; an epoch already held or
   * passed is ignored. Key bytes it no longer needs are overwritten with
   * zeros.
   */
  public addKey(rawKey: Uint8Array, epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch <= this.epoch) {
      rawKey.fill(0);

      return;
    }

    const key = CallMediaFrameCodec.symmetricKey(rawKey);
    const sealer = CallMediaFrameSealer.create(key, {
      callId: this.call.callId,
      epoch,
      senderId: this.call.senderId,
    });

    // A sealer that cannot be created drops the frames that wait for it.
    sealer.catch(() => undefined);
    this.key?.fill(0);
    this.key = rawKey;
    this.epoch = epoch;
    this.sealer = sealer;

    for (const entry of this.openers.values()) {
      this.addOpenerKey(entry, key, epoch);
    }

    this.keyArrived?.();
  }

  /** Releases every key and opener; nothing more opens or is sealed. */
  public dispose(): void {
    this.key?.fill(0);
    this.key = null;
    this.sealer = null;
    this.openers.clear();
  }

  /** Drops the opener of a member who left the call. */
  public forget(senderId: string): void {
    this.openers.delete(senderId);
  }

  /**
   * Opens the inbound frames of `senderId` on `track`, dropping any that do
   * not open: whether a connection is encrypted comes from its negotiation,
   * never from the frame bytes.
   */
  public receiverTransform(
    senderId: string,
    track: () => CallMediaTrack,
  ): TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame> {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        const frameTrack = track();

        try {
          const openedFrame = frame;

          openedFrame.data = CallMediaFrameCodec.arrayBuffer(
            await this.open(senderId, new Uint8Array(frame.data), frameTrack),
          );
          controller.enqueue(openedFrame);
        } catch {
          // Dropped: not sealed by this sender, for this track, with a key
          // this member holds, or already opened.
        }
      },
    });
  }

  /** Seals outbound frames on `track`; none leaves before a key is ready. */
  public senderTransform(
    track: () => CallMediaTrack,
  ): TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame> {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        const frameTrack = track();

        try {
          const sealedFrame = frame;

          sealedFrame.data = CallMediaFrameCodec.arrayBuffer(
            await this.seal(new Uint8Array(frame.data), frameTrack),
          );
          controller.enqueue(sealedFrame);
        } catch {
          // Dropped: a frame that cannot be sealed is never sent.
        }
      },
    });
  }
}
