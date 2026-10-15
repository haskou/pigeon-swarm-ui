import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

import { logCallDebug } from './callDebugLogger';
import { EncodedCallMediaCipher } from './EncodedCallMediaCipher';

/**
 * The end-to-end encryption of one call's media. A private call has a key:
 * every outbound frame is encrypted with it from the first one, an inbound
 * frame that is not is dropped, and a peer that does not announce encrypted
 * media both ways is refused, never downgraded to plaintext. A public call
 * has no key and its media is not encrypted.
 */
export class CallMediaEncryption {
  private cipher: EncodedCallMediaCipher | null = null;

  private required = false;

  private readonly admittedPeers = new Set<string>();

  public static supported(): boolean {
    return EncodedCallMediaCipher.isSupported();
  }

  /** Records that `peerIdentityId` described itself as `admits` requires. */
  public admit(
    peerIdentityId: string,
    peer: RTCPeerConnection | undefined,
  ): void {
    if (this.cipher) this.admittedPeers.add(peerIdentityId);
    this.syncPeer(peer);
  }

  /**
   * Whether a peer describing itself with `payload` may join this call: any
   * peer of a public call; in a private call only one that sends and accepts
   * encrypted media, and only while this browser encrypts it too.
   */
  public admits(payload: DescriptionSignalPayload): boolean {
    const metadata = payload.mediaEncryption;

    return (
      !this.required ||
      (Boolean(this.cipher) &&
        metadata?.acceptsEncrypted === true &&
        metadata.enabled === true)
    );
  }

  /** A private call has `base64Key`; a public one has none. */
  public configure(base64Key: null | string): void {
    const supported = EncodedCallMediaCipher.isSupported();

    this.required = Boolean(base64Key);
    this.cipher =
      base64Key && supported ? new EncodedCallMediaCipher(base64Key) : null;
    logCallDebug('peer-manager:media-encryption:configure', {
      hasKey: this.required,
      supported,
    });
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    this.cipher?.configureReceiver(receiver);
  }

  public configureSender(sender: RTCRtpSender): void {
    this.cipher?.configureSender(sender);
  }

  public forget(peerIdentityId: string): void {
    this.admittedPeers.delete(peerIdentityId);
  }

  public isActiveWith(peerIdentityId: string): boolean {
    return Boolean(this.cipher) && this.admittedPeers.has(peerIdentityId);
  }

  public localMetadata(): DescriptionSignalPayload['mediaEncryption'] {
    const encrypted = Boolean(this.cipher);

    return { acceptsEncrypted: encrypted, enabled: encrypted, version: 1 };
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    if (!this.cipher) return rtcConfiguration;

    return {
      ...rtcConfiguration,
      encodedInsertableStreams: true,
    } as RTCConfiguration;
  }

  public reset(): void {
    this.admittedPeers.clear();
    this.cipher = null;
    this.required = false;
  }

  public syncPeer(peer: RTCPeerConnection | undefined): void {
    if (!peer) return;

    peer.getSenders().forEach((sender) => this.configureSender(sender));
    peer
      .getReceivers?.()
      .forEach((receiver) => this.configureReceiver(receiver));
  }

  public syncPeers(peers: Map<string, RTCPeerConnection>): void {
    for (const peer of peers.values()) this.syncPeer(peer);
  }
}
