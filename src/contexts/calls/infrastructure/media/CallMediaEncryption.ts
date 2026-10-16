import type { CallMediaFramePeer } from '@haskou/pigeon-swarm-crypto';

import type { CallMediaCipher } from './CallMediaCipher';
import type { CallMediaKey } from './CallMediaKey';
import type { CallMediaTrack } from './CallMediaTrack';
import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

import { logCallDebug } from './callDebugLogger';
import { callMediaTrackOf } from './callMediaTrackOf';
import { EncodedStreamsCallMediaCipher } from './EncodedStreamsCallMediaCipher';
import { ScriptTransformCallMediaCipher } from './ScriptTransformCallMediaCipher';

/** The media encryption version this client seals and opens: PSCE2. */
const mediaEncryptionVersion = 2;

/**
 * The end-to-end encryption of one call's media. A private call has a key:
 * every outbound frame is sealed with it from the first one, an inbound
 * frame that does not open is dropped, and a peer that does not announce
 * encrypted media of this version both ways is refused, never downgraded to
 * plaintext. Once this browser fails to encrypt the call, it sends and plays
 * none of its media and admits no peer. A public call has no key and its
 * media is not encrypted.
 */
export class CallMediaEncryption {
  private cipher: CallMediaCipher | null = null;

  private required = false;

  private readonly admittedPeers = new Set<string>();

  private readonly receiverTracks = new WeakMap<
    RTCRtpReceiver,
    CallMediaTrack
  >();

  private readonly senderTracks = new WeakMap<RTCRtpSender, CallMediaTrack>();

  /**
   * The cipher this browser encrypts with: a worker transform where it has
   * one, the encoded streams of older Chromium builds otherwise.
   */
  private static cipherFor(
    call: CallMediaFramePeer,
    key: CallMediaKey,
  ): CallMediaCipher | null {
    if (ScriptTransformCallMediaCipher.isSupported())
      return new ScriptTransformCallMediaCipher(call, key);

    if (EncodedStreamsCallMediaCipher.isSupported())
      return new EncodedStreamsCallMediaCipher(call, key);

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

  /**
   * The track `sender` seals for: that of its local track, or the one it
   * had. A sender with no track sends no frame until one moves it.
   */
  private senderTrack(sender: RTCRtpSender): CallMediaTrack {
    const track = sender.track
      ? callMediaTrackOf(sender.track)
      : (this.senderTracks.get(sender) ?? 'audio');

    this.senderTracks.set(sender, track);

    return track;
  }

  /** Whether this browser cannot encrypt a private call. */
  public get failed(): boolean {
    return this.required && !this.encrypts();
  }

  /** Records that `peerIdentityId` described itself as `admits` requires. */
  public admit(
    peerIdentityId: string,
    peer: RTCPeerConnection | undefined,
  ): void {
    if (this.encrypts()) this.admittedPeers.add(peerIdentityId);
    this.syncPeer(peerIdentityId, peer);
  }

  /**
   * Whether a peer describing itself with `payload` may join this call: any
   * peer of a public call; in a private call only one that sends and accepts
   * media encrypted in this version, and only while this browser encrypts it
   * too.
   */
  public admits(payload: DescriptionSignalPayload): boolean {
    const metadata = payload.mediaEncryption;

    return (
      !this.required ||
      (this.encrypts() &&
        metadata?.version === mediaEncryptionVersion &&
        metadata.acceptsEncrypted === true &&
        metadata.enabled === true)
    );
  }

  /**
   * A private call has the `key` this identity seals `call`'s media with; a
   * public one has none.
   */
  public configure(call: CallMediaFramePeer, key: CallMediaKey | null): void {
    const cipher = key ? CallMediaEncryption.cipherFor(call, key) : null;

    this.cipher?.dispose();
    this.cipher = cipher;
    this.required = Boolean(key);
    logCallDebug('peer-manager:media-encryption:configure', {
      encrypted: Boolean(this.cipher),
      hasKey: this.required,
    });
  }

  /**
   * Opens the media `receiver` plays from `peerIdentityId`, on `track` once
   * the remote track is known; until then on the track of its kind.
   */
  public configureReceiver(
    peerIdentityId: string,
    receiver: RTCRtpReceiver,
    track?: CallMediaTrack,
  ): void {
    if (!this.cipher) return;

    const receiverTrack =
      track ??
      this.receiverTracks.get(receiver) ??
      (receiver.track.kind === 'audio' ? 'audio' : 'video');

    this.receiverTracks.set(receiver, receiverTrack);

    // Media this browser cannot decrypt is never played.
    if (
      !this.cipher.configureReceiver(receiver, peerIdentityId, receiverTrack)
    ) {
      receiver.track.stop();
    }
  }

  public configureSender(sender: RTCRtpSender): void {
    if (!this.cipher) return;

    // Media this browser cannot encrypt is never sent.
    if (!this.cipher.configureSender(sender, this.senderTrack(sender))) {
      void sender.replaceTrack(null).catch(() => undefined);
    }
  }

  public forget(peerIdentityId: string): void {
    this.admittedPeers.delete(peerIdentityId);
    this.cipher?.forget(peerIdentityId);
  }

  public isActiveWith(peerIdentityId: string): boolean {
    return this.encrypts() && this.admittedPeers.has(peerIdentityId);
  }

  public localMetadata(): DescriptionSignalPayload['mediaEncryption'] {
    const encrypted = this.encrypts();

    return {
      acceptsEncrypted: encrypted,
      enabled: encrypted,
      version: mediaEncryptionVersion,
    };
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    return this.cipher?.peerConfiguration(rtcConfiguration) ?? rtcConfiguration;
  }

  /** Moves a private call to the `key` of a newer epoch. */
  public rekey(key: CallMediaKey): void {
    this.cipher?.rekey(key);
    logCallDebug('peer-manager:media-encryption:rekey', { epoch: key.epoch });
  }

  public reset(): void {
    this.admittedPeers.clear();
    this.cipher?.dispose();
    this.cipher = null;
    this.required = false;
  }

  public syncPeer(
    peerIdentityId: string,
    peer: RTCPeerConnection | undefined,
  ): void {
    if (!peer) return;

    peer.getSenders().forEach((sender) => this.configureSender(sender));
    peer
      .getReceivers?.()
      .forEach((receiver) => this.configureReceiver(peerIdentityId, receiver));
  }

  public syncPeers(peers: Map<string, RTCPeerConnection>): void {
    for (const [peerIdentityId, peer] of peers) {
      this.syncPeer(peerIdentityId, peer);
    }
  }
}
