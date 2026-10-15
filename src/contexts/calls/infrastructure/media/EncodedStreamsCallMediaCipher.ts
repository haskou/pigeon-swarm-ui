import type { CallMediaCipher } from './CallMediaCipher';
import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';
import type { EncodedCallMediaFrameStreams } from './EncodedCallMediaFrameStreams';
import type { EncodedCallMediaStreamOwner } from './EncodedCallMediaStreamOwner';

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

  private static configureEncodedStreams(
    owner: EncodedCallMediaStreamOwner,
    transform: TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>,
  ): boolean {
    let streams: EncodedCallMediaFrameStreams | undefined;

    try {
      streams = owner.createEncodedStreams?.();
    } catch {
      return false;
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
      CallMediaFrameCodec.importKey(CallMediaFrameCodec.rawKey(base64Key)),
    );
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    if (this.configuredReceivers.has(receiver)) return;

    if (!isEncodedStreamOwner(receiver)) return;

    const configured = EncodedStreamsCallMediaCipher.configureEncodedStreams(
      receiver,
      this.codec.receiverTransform(),
    );

    if (configured) this.configuredReceivers.add(receiver);
  }

  public configureSender(sender: RTCRtpSender): void {
    if (this.configuredSenders.has(sender)) return;

    if (!isEncodedStreamOwner(sender)) return;

    const configured = EncodedStreamsCallMediaCipher.configureEncodedStreams(
      sender,
      this.codec.senderTransform(),
    );

    if (configured) this.configuredSenders.add(sender);
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
