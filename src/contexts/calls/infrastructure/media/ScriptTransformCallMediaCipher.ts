import type { CallMediaCipher } from './CallMediaCipher';
import type { CallMediaKeyMessage } from './CallMediaKeyMessage';

import { logCallError } from './callDebugLogger';
import callMediaEncryptionWorkerUrl from './callMediaEncryptionWorker?worker&url';
import { CallMediaFrameCodec } from './CallMediaFrameCodec';

/**
 * Encrypts a private call's media in a dedicated worker through
 * RTCRtpScriptTransform. The call key bytes are transferred to the worker
 * once, so neither this object nor any transform keeps them. A sender or
 * receiver the browser will not transform is stopped rather than carrying
 * plaintext.
 */
export class ScriptTransformCallMediaCipher implements CallMediaCipher {
  private readonly configuredReceivers = new WeakSet<RTCRtpReceiver>();

  private readonly configuredSenders = new WeakSet<RTCRtpSender>();

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
      logCallError('peer-manager:media-encryption:worker-failed', error);
    });
    this.worker.postMessage(key, [key.key]);
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    if (this.configuredReceivers.has(receiver)) return;

    try {
      // eslint-disable-next-line no-param-reassign -- applied on assignment
      receiver.transform = new RTCRtpScriptTransform(this.worker, {
        side: 'receive',
      });
      this.configuredReceivers.add(receiver);
    } catch (error) {
      logCallError('peer-manager:media-encryption:transform-failed', error);
      receiver.track.stop();
    }
  }

  public configureSender(sender: RTCRtpSender): void {
    if (this.configuredSenders.has(sender)) return;

    try {
      // eslint-disable-next-line no-param-reassign -- applied on assignment
      sender.transform = new RTCRtpScriptTransform(this.worker, {
        side: 'send',
      });
      this.configuredSenders.add(sender);
    } catch (error) {
      logCallError('peer-manager:media-encryption:transform-failed', error);
      void sender.replaceTrack(null).catch(() => undefined);
    }
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
