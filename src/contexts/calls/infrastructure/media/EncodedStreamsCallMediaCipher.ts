import type { CallMediaFramePeer } from '@haskou/pigeon-swarm-crypto';

import type { CallMediaCipher } from './CallMediaCipher';
import type { CallMediaKey } from './CallMediaKey';
import type { CallMediaTrack } from './CallMediaTrack';
import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';
import type { EncodedCallMediaFrameStreams } from './EncodedCallMediaFrameStreams';
import type { EncodedCallMediaStreamOwner } from './EncodedCallMediaStreamOwner';

import { logCallError } from './callDebugLogger';
import { CallMediaFrameCodec } from './CallMediaFrameCodec';

function isEncodedStreamOwner(
  value: unknown,
): value is EncodedCallMediaStreamOwner {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncodedCallMediaStreamOwner).createEncodedStreams ===
      'function'
  );
}

/**
 * Encrypts a private call's media on the main thread through the encoded
 * streams of Chromium builds that cannot take an RTCRtpScriptTransform.
 */
export class EncodedStreamsCallMediaCipher implements CallMediaCipher {
  private readonly codec: CallMediaFrameCodec;

  private readonly configuredReceivers = new WeakMap<
    RTCRtpReceiver,
    CallMediaTrack
  >();

  private readonly configuredSenders = new WeakMap<
    RTCRtpSender,
    CallMediaTrack
  >();

  private hasFailed = false;

  /** Pipes `owner`'s encoded frames through `transform`, if it lets it. */
  private static pipeEncodedStreams(
    owner: unknown,
    transform: TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>,
  ): boolean {
    let streams: EncodedCallMediaFrameStreams | undefined;

    try {
      streams = isEncodedStreamOwner(owner)
        ? owner.createEncodedStreams?.()
        : undefined;
    } catch (error) {
      logCallError('peer-manager:media-encryption:transform-failed', error);
    }

    if (!streams) return false;

    void streams.readable
      .pipeThrough(transform)
      .pipeTo(streams.writable)
      .catch(() => undefined);

    return true;
  }

  public static isSupported(): boolean {
    return (
      typeof TransformStream !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      !!crypto.subtle &&
      typeof RTCRtpSender !== 'undefined' &&
      typeof RTCRtpReceiver !== 'undefined' &&
      isEncodedStreamOwner(RTCRtpSender.prototype) &&
      isEncodedStreamOwner(RTCRtpReceiver.prototype)
    );
  }

  /** `call` names the call and this identity, which seals with `key`. */
  public constructor(call: CallMediaFramePeer, key: CallMediaKey) {
    this.codec = new CallMediaFrameCodec({
      callId: call.callId,
      senderId: call.senderId,
    });
    this.rekey(key);
  }

  /**
   * Pipes `owner` through `transform` once; a later call only moves it to
   * `track`, which every frame reads as it passes.
   */
  private pipe<Owner extends object>(
    owner: Owner,
    configured: WeakMap<Owner, CallMediaTrack>,
    track: CallMediaTrack,
    transform: (
      track: () => CallMediaTrack,
    ) => TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>,
  ): boolean {
    if (this.hasFailed) return false;

    if (configured.has(owner)) {
      configured.set(owner, track);

      return true;
    }

    const frameTrack = (): CallMediaTrack => configured.get(owner) ?? track;

    if (
      !EncodedStreamsCallMediaCipher.pipeEncodedStreams(
        owner,
        transform(frameTrack),
      )
    ) {
      this.hasFailed = true;

      return false;
    }

    configured.set(owner, track);

    return true;
  }

  public get failed(): boolean {
    return this.hasFailed;
  }

  public configureReceiver(
    receiver: RTCRtpReceiver,
    senderId: string,
    track: CallMediaTrack,
  ): boolean {
    return this.pipe(receiver, this.configuredReceivers, track, (frameTrack) =>
      this.codec.receiverTransform(senderId, frameTrack),
    );
  }

  public configureSender(sender: RTCRtpSender, track: CallMediaTrack): boolean {
    return this.pipe(sender, this.configuredSenders, track, (frameTrack) =>
      this.codec.senderTransform(frameTrack),
    );
  }

  public dispose(): void {
    // The encoded streams end with their peers; the keys end here.
    this.codec.dispose();
  }

  public forget(senderId: string): void {
    this.codec.forget(senderId);
  }

  /** Encoded streams exist only on peers created asking for them. */
  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    return {
      ...rtcConfiguration,
      encodedInsertableStreams: true,
    } as RTCConfiguration;
  }

  public rekey(key: CallMediaKey): void {
    this.codec.addKey(CallMediaFrameCodec.rawKey(key.key), key.epoch);
  }
}
