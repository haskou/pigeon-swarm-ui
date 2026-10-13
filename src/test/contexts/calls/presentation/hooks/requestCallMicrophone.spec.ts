import { requestCallMicrophone } from '../../../../../contexts/calls/presentation/hooks/requestCallMicrophone';

function browser(mediaDevices: Partial<MediaDevices>): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices },
  });
}

// Browsers reject getUserMedia with a DOMException; specs run in their own
// realm, so the error is built with the same name instead.
function domError(name: string): Error {
  return Object.assign(new Error('microphone request failed'), { name });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'navigator');
});

describe('requestCallMicrophone', () => {
  it('returns the captured microphone', async () => {
    const stream = {
      getAudioTracks: () => [],
      getTracks: () => [],
    } as unknown as MediaStream;

    browser({ getUserMedia: jest.fn().mockResolvedValue(stream) });

    await expect(
      requestCallMicrophone({ noiseCancellationEnabled: false }),
    ).resolves.toEqual({ stream });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'missing-device'],
    ['NotReadableError', 'in-use'],
    ['OverconstrainedError', 'constraint'],
  ])('keeps why the microphone failed with %s', async (name, code) => {
    browser({ getUserMedia: jest.fn().mockRejectedValue(domError(name)) });

    await expect(
      requestCallMicrophone({ noiseCancellationEnabled: false }),
    ).resolves.toEqual({ microphoneError: code, stream: null });
  });

  it('reports a browser without microphone capture as unsupported', async () => {
    browser({});

    await expect(
      requestCallMicrophone({ noiseCancellationEnabled: false }),
    ).resolves.toEqual({ microphoneError: 'unsupported', stream: null });
  });
});
