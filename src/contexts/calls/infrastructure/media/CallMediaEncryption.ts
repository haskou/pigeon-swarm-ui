import type { CallMediaCipher } from './CallMediaCipher';
import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

import { logCallDebug } from './callDebugLogger';
import { EncodedStreamsCallMediaCipher } from './EncodedStreamsCallMediaCipher';
import { ScriptTransformCallMediaCipher } from './ScriptTransformCallMediaCipher';

/**
 * The end-to-end encryption of one call's media. A private call has a key:
 * every outbound frame is encrypted with it from the first one, an inbound
 * frame that is not is dropped, and a peer that does not announce encrypted
 * media both ways is refused, never downgraded to plaintext. Once this
 * browser fails to encrypt the call, it sends and plays none of its media
 * and admits no peer. A public call has no key and its media is not
 * encrypted.
 */
export class CallMediaEncryption {
  private cipher: CallMediaCipher | null = null;

  private required = false;

  private readonly admittedPeers = new Set<string>();

  /**
   * The cipher this browser encrypts with: a worker transform where it has
   * one, the encoded streams of older Chromium builds otherwise.
   */
  private static cipherFor(base64Key: string): CallMediaCipher | null {
    if (ScriptTransformCallMediaCipher.isSupported())
      return new ScriptTransformCallMediaCipher(base64Key);

    if (EncodedStreamsCallMediaCipher.isSupported())
      return new EncodedStreamsCallMediaCipher(base64Key);

    return null;
  }

  public static supported(): boolean {
    return (
      ScriptTransformCallMediaCipher.isSupported() ||
      EncodedStreamsCallMediaCipher.isSupported()
    );
  }

  /** Whether this browser encrypts the call's media now. */
  private encrypts(): boolean {
    return this.cipher?.failed === false;
  }

  /** Whether this browser failed to encrypt a private call. */
  public get failed(): boolean {
    return this.cipher?.failed === true;
  }

  /** Records that `peerIdentityId` described itself as `admits` requires. */
  public admit(
    peerIdentityId: string,
    peer: RTCPeerConnection | undefined,
  ): void {
    if (this.encrypts()) this.admittedPeers.add(peerIdentityId);
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
      (this.encrypts() &&
        metadata?.acceptsEncrypted === true &&
        metadata.enabled === true)
    );
  }

  /** A private call has `base64Key`; a public one has none. */
  public configure(base64Key: null | string): void {
    const cipher = base64Key ? CallMediaEncryption.cipherFor(base64Key) : null;

    this.cipher?.dispose();
    this.cipher = cipher;
    this.required = Boolean(base64Key);
    logCallDebug('peer-manager:media-encryption:configure', {
      encrypted: Boolean(this.cipher),
      hasKey: this.required,
    });
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    // Media this browser cannot decrypt is never played.
    if (this.cipher?.configureReceiver(receiver) === false) {
      receiver.track.stop();
    }
  }

  public configureSender(sender: RTCRtpSender): void {
    // Media this browser cannot encrypt is never sent.
    if (this.cipher?.configureSender(sender) === false) {
      void sender.replaceTrack(null).catch(() => undefined);
    }
  }

  public forget(peerIdentityId: string): void {
    this.admittedPeers.delete(peerIdentityId);
  }

  public isActiveWith(peerIdentityId: string): boolean {
    return this.encrypts() && this.admittedPeers.has(peerIdentityId);
  }

  public localMetadata(): DescriptionSignalPayload['mediaEncryption'] {
    const encrypted = this.encrypts();

    return { acceptsEncrypted: encrypted, enabled: encrypted, version: 1 };
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    return this.cipher?.peerConfiguration(rtcConfiguration) ?? rtcConfiguration;
  }

  public reset(): void {
    this.admittedPeers.clear();
    this.cipher?.dispose();
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
