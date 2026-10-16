import type { CallMediaFramePeer } from '@haskou/pigeon-swarm-crypto';

import type { CallMediaCipher } from './CallMediaCipher';
import type { CallMediaKey } from './CallMediaKey';
import type { CallMediaTrack } from './CallMediaTrack';
import type { CallMediaTransformOptions } from './CallMediaTransformOptions';
import type { CallMediaWorkerMessage } from './CallMediaWorkerMessage';

import { logCallError } from './callDebugLogger';
import callMediaEncryptionWorkerUrl from './callMediaEncryptionWorker?worker&url';
import { CallMediaFrameCodec } from './CallMediaFrameCodec';

/**
 * Encrypts a private call's media in a dedicated worker through
 * RTCRtpScriptTransform. The bytes of each epoch's call key are transferred
 * to the worker, so neither this object nor any transform keeps them.
 */
export class ScriptTransformCallMediaCipher implements CallMediaCipher {
  private readonly configuredReceivers = new WeakMap<
    RTCRtpReceiver,
    CallMediaTrack
  >();

  private readonly configuredSenders = new WeakMap<
    RTCRtpSender,
    CallMediaTrack
  >();

  private hasFailed = false;

  private readonly worker: Worker;

  public static isSupported(): boolean {
    return (
      typeof RTCRtpScriptTransform === 'function' &&
      typeof Worker === 'function' &&
      typeof crypto !== 'undefined' &&
      !!crypto.subtle &&
      typeof RTCRtpSender !== 'undefined' &&
      typeof RTCRtpReceiver !== 'undefined' &&
      'transform' in RTCRtpSender.prototype &&
      'transform' in RTCRtpReceiver.prototype
    );
  }

  /** `call` names the call and this identity, which seals with `key`. */
  public constructor(
    private readonly call: CallMediaFramePeer,
    key: CallMediaKey,
  ) {
    const message: CallMediaWorkerMessage = {
      callId: call.callId,
      senderId: call.senderId,
      type: 'call',
    };
    // A key it cannot read starts no worker.
    const rawKey = CallMediaFrameCodec.rawKey(key.key);

    this.worker = new Worker(callMediaEncryptionWorkerUrl, { type: 'module' });
    // Without its worker no frame of the call is encoded or played.
    this.worker.addEventListener('error', (error) => {
      this.hasFailed = true;
      logCallError('peer-manager:media-encryption:worker-failed', error);
    });
    this.worker.postMessage(message);
    this.postKey(rawKey, key.epoch);
  }

  /** Transfers `rawKey` to the worker, so no copy stays on this thread. */
  private postKey(rawKey: Uint8Array<ArrayBuffer>, epoch: number): void {
    const message: CallMediaWorkerMessage = {
      epoch,
      key: rawKey.buffer,
      type: 'key',
    };

    this.worker.postMessage(message, [message.key]);
  }

  /**
   * Gives `owner` a transform for `options`, unless it already has one for
   * the same track: a transform's options are fixed, so moving it to another
   * track takes a new one.
   */
  private transform<Owner extends RTCRtpReceiver | RTCRtpSender>(
    owner: Owner,
    configured: WeakMap<Owner, CallMediaTrack>,
    options: CallMediaTransformOptions,
  ): boolean {
    if (this.hasFailed) return false;

    if (configured.get(owner) === options.track) return true;

    try {
      // eslint-disable-next-line no-param-reassign -- applied on assignment
      owner.transform = new RTCRtpScriptTransform(this.worker, options);
      configured.set(owner, options.track);

      return true;
    } catch (error) {
      this.hasFailed = true;
      logCallError('peer-manager:media-encryption:transform-failed', error);

      return false;
    }
  }

  public get failed(): boolean {
    return this.hasFailed;
  }

  public configureReceiver(
    receiver: RTCRtpReceiver,
    senderId: string,
    track: CallMediaTrack,
  ): boolean {
    return this.transform(receiver, this.configuredReceivers, {
      senderId,
      side: 'receive',
      track,
    });
  }

  public configureSender(sender: RTCRtpSender, track: CallMediaTrack): boolean {
    return this.transform(sender, this.configuredSenders, {
      senderId: this.call.senderId,
      side: 'send',
      track,
    });
  }

  public dispose(): void {
    this.worker.terminate();
  }

  public forget(senderId: string): void {
    const message: CallMediaWorkerMessage = { senderId, type: 'forget' };

    this.worker.postMessage(message);
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    return rtcConfiguration;
  }

  public rekey(key: CallMediaKey): void {
    this.postKey(CallMediaFrameCodec.rawKey(key.key), key.epoch);
  }
}
