import type { CallMediaCipher } from './CallMediaCipher';
import type { CallMediaKeyMessage } from './CallMediaKeyMessage';

import { logCallError } from './callDebugLogger';
import callMediaEncryptionWorkerUrl from './callMediaEncryptionWorker?worker&url';
import { CallMediaFrameCodec } from './CallMediaFrameCodec';

/**
 * Encrypts a private call's media in a dedicated worker through
 * RTCRtpScriptTransform. The call key bytes are transferred to the worker
 * once, so neither this object nor any transform keeps them.
 */
export class ScriptTransformCallMediaCipher implements CallMediaCipher {
  private readonly configuredReceivers = new WeakSet<RTCRtpReceiver>();

  private readonly configuredSenders = new WeakSet<RTCRtpSender>();

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

  public constructor(base64Key: string) {
    const key: CallMediaKeyMessage = {
      key: CallMediaFrameCodec.rawKey(base64Key),
    };

    this.worker = new Worker(callMediaEncryptionWorkerUrl, { type: 'module' });
    // Without its worker no frame of the call is encoded or played.
    this.worker.addEventListener('error', (error) => {
      this.hasFailed = true;
      logCallError('peer-manager:media-encryption:worker-failed', error);
    });
    this.worker.postMessage(key, [key.key]);
  }

  private transform<Owner extends RTCRtpReceiver | RTCRtpSender>(
    owner: Owner,
    configured: WeakSet<Owner>,
    side: 'receive' | 'send',
  ): boolean {
    if (this.hasFailed) return false;

    if (configured.has(owner)) return true;

    try {
      // eslint-disable-next-line no-param-reassign -- applied on assignment
      owner.transform = new RTCRtpScriptTransform(this.worker, { side });
      configured.add(owner);

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

  public configureReceiver(receiver: RTCRtpReceiver): boolean {
    return this.transform(receiver, this.configuredReceivers, 'receive');
  }

  public configureSender(sender: RTCRtpSender): boolean {
    return this.transform(sender, this.configuredSenders, 'send');
  }

  public dispose(): void {
    this.worker.terminate();
  }

  public peerConfiguration(
    rtcConfiguration: RTCConfiguration,
  ): RTCConfiguration {
    return rtcConfiguration;
  }
}
