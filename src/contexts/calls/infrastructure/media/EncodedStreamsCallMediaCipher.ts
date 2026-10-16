import type { CallMediaCipher } from './CallMediaCipher';
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

  private readonly configuredReceivers = new WeakSet<RTCRtpReceiver>();

  private readonly configuredSenders = new WeakSet<RTCRtpSender>();

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

  public constructor(base64Key: string) {
    this.codec = new CallMediaFrameCodec(
      CallMediaFrameCodec.cipherOfKey(base64Key),
    );
  }

  private pipe<Owner extends object>(
    owner: Owner,
    configured: WeakSet<Owner>,
    transform: () => TransformStream<
      EncodedCallMediaFrame,
      EncodedCallMediaFrame
    >,
  ): boolean {
    if (this.hasFailed) return false;

    if (configured.has(owner)) return true;

    if (!EncodedStreamsCallMediaCipher.pipeEncodedStreams(owner, transform())) {
      this.hasFailed = true;

      return false;
    }

    configured.add(owner);

    return true;
  }

  public get failed(): boolean {
    return this.hasFailed;
  }

  public configureReceiver(receiver: RTCRtpReceiver): boolean {
    return this.pipe(receiver, this.configuredReceivers, () =>
      this.codec.receiverTransform(),
    );
  }

  public configureSender(sender: RTCRtpSender): boolean {
    return this.pipe(sender, this.configuredSenders, () =>
      this.codec.senderTransform(),
    );
  }

  public dispose(): void {
    // Nothing to release: the encoded streams end with their peers.
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
}
