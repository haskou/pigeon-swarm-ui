import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

import { logCallDebug } from './callDebugLogger';
import { EncodedCallMediaCipher } from './EncodedCallMediaCipher';

export class CallMediaEncryption {
  private cipher: EncodedCallMediaCipher | null = null;

  private enabled = false;

  private readonly peerAcceptsEncryptedMedia = new Map<string, boolean>();

  private readonly peerSendsEncryptedMedia = new Map<string, boolean>();

  public static supported(): boolean {
    return EncodedCallMediaCipher.isSupported();
  }

  public acceptsEncrypted(): boolean {
    return Boolean(this.cipher) && this.enabled;
  }

  public configure(base64Key: null | string, enabled: boolean): void {
    const supported = EncodedCallMediaCipher.isSupported();

    this.cipher =
      base64Key && supported ? new EncodedCallMediaCipher(base64Key) : null;
    this.enabled = Boolean(enabled && this.cipher);
    logCallDebug('peer-manager:media-encryption:configure', {
      enabled: this.enabled,
      hasKey: Boolean(base64Key),
      supported,
    });
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    this.cipher?.configureReceiver(receiver);
  }

  public configureSender(sender: RTCRtpSender, peerIdentityId: string): void {
    this.cipher?.configureSender(sender, () =>
      this.outboundEnabled(peerIdentityId),
    );
  }

  public forget(peerIdentityId: string): void {
    this.peerAcceptsEncryptedMedia.delete(peerIdentityId);
    this.peerSendsEncryptedMedia.delete(peerIdentityId);
  }

  public isActiveWith(peerIdentityId: string): boolean {
    return (
      this.outboundEnabled(peerIdentityId) &&
      (this.peerSendsEncryptedMedia.get(peerIdentityId) ?? false)
    );
  }

  public localMetadata(
    peerIdentityId: string,
  ): DescriptionSignalPayload['mediaEncryption'] {
    return {
      acceptsEncrypted: this.acceptsEncrypted(),
      enabled: this.outboundEnabled(peerIdentityId),
      version: 1,
    };
  }

  public outboundEnabled(peerIdentityId: string): boolean {
    return (
      Boolean(this.cipher) &&
      this.enabled &&
      (this.peerAcceptsEncryptedMedia.get(peerIdentityId) ?? false)
    );
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    if (!this.cipher || !EncodedCallMediaCipher.isSupported()) {
      return rtcConfiguration;
    }

    return {
      ...rtcConfiguration,
      encodedInsertableStreams: true,
    } as RTCConfiguration;
  }

  public rememberRemoteMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
    peer: RTCPeerConnection | undefined,
  ): void {
    const mediaEncryption = payload.mediaEncryption;

    this.peerAcceptsEncryptedMedia.set(
      peerIdentityId,
      mediaEncryption?.acceptsEncrypted ?? false,
    );
    this.peerSendsEncryptedMedia.set(
      peerIdentityId,
      mediaEncryption?.enabled ?? false,
    );
    this.syncPeer(peerIdentityId, peer);
  }

  public reset(): void {
    this.peerAcceptsEncryptedMedia.clear();
    this.peerSendsEncryptedMedia.clear();
    this.cipher = null;
    this.enabled = false;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled && this.cipher);
    logCallDebug('peer-manager:media-encryption:set-enabled', {
      enabled: this.enabled,
    });
  }

  public syncPeer(
    peerIdentityId: string,
    peer: RTCPeerConnection | undefined,
  ): void {
    if (!peer) return;

    peer
      .getSenders()
      .forEach((sender) => this.configureSender(sender, peerIdentityId));
    peer
      .getReceivers?.()
      .forEach((receiver) => this.configureReceiver(receiver));
  }

  public syncPeers(peers: Map<string, RTCPeerConnection>): void {
    for (const [peerIdentityId, peer] of peers.entries()) {
      this.syncPeer(peerIdentityId, peer);
    }
  }
}
