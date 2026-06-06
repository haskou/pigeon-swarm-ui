const mockLoadRnnoise = jest.fn();
const mockProcessorInstances: MockRnnoiseWorkletNode[] = [];

class MockRnnoiseWorkletNode {
  public readonly connect = jest.fn((destination: unknown) => destination);

  public readonly destroy = jest.fn();

  public readonly disconnect = jest.fn();

  public constructor(
    public readonly context: AudioContext,
    public readonly options: { maxChannels: number; wasmBinary: ArrayBuffer },
  ) {
    mockProcessorInstances.push(this);
  }
}

jest.mock('@sapphi-red/web-noise-suppressor', () => ({
  loadRnnoise: mockLoadRnnoise,
  RnnoiseWorkletNode: MockRnnoiseWorkletNode,
}));

import { CallMicrophoneCapture } from './CallMicrophoneCapture';

function mediaStreamWithAudioTrack(): MediaStream & {
  audioTrack: MediaStreamTrack;
} {
  const audioTrack = {
    contentHint: '',
    stop: jest.fn(),
  } as unknown as MediaStreamTrack;

  return {
    audioTrack,
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack],
  } as unknown as MediaStream & { audioTrack: MediaStreamTrack };
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function restoreGlobalWindow(): void {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);

    return;
  }

  Reflect.deleteProperty(globalThis, 'window');
}

describe(CallMicrophoneCapture.name, () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockProcessorInstances.length = 0;
    restoreGlobalWindow();
  });

  it('requests microphone audio with browser audio processing enabled', async () => {
    const stream = mediaStreamWithAudioTrack();
    const mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(stream),
    };

    await expect(CallMicrophoneCapture.capture(mediaDevices)).resolves.toBe(
      stream,
    );

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    expect(stream.audioTrack.contentHint).toBe('speech');
  });

  it('routes microphone audio through RNNoise when AudioWorklet is available', async () => {
    const inputStream = mediaStreamWithAudioTrack();
    const outputStream = mediaStreamWithAudioTrack();
    const wasmBinary = new ArrayBuffer(8);
    const source = {
      connect: jest.fn((node: unknown) => node),
      disconnect: jest.fn(),
    };
    const destination = { stream: outputStream };
    const audioContext = {
      audioWorklet: {
        addModule: jest.fn().mockResolvedValue(undefined),
      },
      close: jest.fn().mockResolvedValue(undefined),
      createMediaStreamDestination: jest.fn(() => destination),
      createMediaStreamSource: jest.fn(() => source),
    };
    const AudioContextConstructor = jest.fn(() => audioContext);

    mockLoadRnnoise.mockResolvedValue(wasmBinary);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        AudioContext: AudioContextConstructor,
      },
    });

    await expect(
      CallMicrophoneCapture.capture({
        getUserMedia: jest.fn().mockResolvedValue(inputStream),
      }),
    ).resolves.toBe(outputStream);

    expect(AudioContextConstructor).toHaveBeenCalledWith({
      sampleRate: 48_000,
    });
    expect(mockLoadRnnoise).toHaveBeenCalledWith({
      simdUrl: '/asset-url-mock',
      url: '/asset-url-mock',
    });
    expect(audioContext.audioWorklet.addModule).toHaveBeenCalledWith(
      '/asset-url-mock',
    );
    expect(mockProcessorInstances[0]?.options).toEqual({
      maxChannels: 1,
      wasmBinary,
    });
    expect(source.connect).toHaveBeenCalledWith(mockProcessorInstances[0]);
    expect(mockProcessorInstances[0]?.connect).toHaveBeenCalledWith(
      destination,
    );
    expect(outputStream.audioTrack.contentHint).toBe('speech');

    CallMicrophoneCapture.stop(outputStream);

    expect(outputStream.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(inputStream.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(mockProcessorInstances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(mockProcessorInstances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(audioContext.close).toHaveBeenCalledTimes(1);
  });

  it('skips RNNoise when noise cancellation is disabled', async () => {
    const stream = mediaStreamWithAudioTrack();
    const mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(stream),
    };

    await expect(
      CallMicrophoneCapture.capture(mediaDevices, {
        noiseCancellationEnabled: false,
      }),
    ).resolves.toBe(stream);

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: false,
      },
      video: false,
    });
    expect(mockLoadRnnoise).not.toHaveBeenCalled();
  });

  it('stops only audio processing when replacing a processed microphone', async () => {
    const inputStream = mediaStreamWithAudioTrack();
    const outputStream = mediaStreamWithAudioTrack();
    const videoTrack = {
      stop: jest.fn(),
    } as unknown as MediaStreamTrack;
    const source = {
      connect: jest.fn((node: unknown) => node),
      disconnect: jest.fn(),
    };
    const audioContext = {
      audioWorklet: {
        addModule: jest.fn().mockResolvedValue(undefined),
      },
      close: jest.fn().mockResolvedValue(undefined),
      createMediaStreamDestination: jest.fn(() => ({ stream: outputStream })),
      createMediaStreamSource: jest.fn(() => source),
    };

    mockLoadRnnoise.mockResolvedValue(new ArrayBuffer(8));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        AudioContext: jest.fn(() => audioContext),
      },
    });

    const processed = await CallMicrophoneCapture.capture({
      getUserMedia: jest.fn().mockResolvedValue(inputStream),
    });

    jest
      .spyOn(processed, 'getTracks')
      .mockReturnValue([outputStream.audioTrack, videoTrack]);

    CallMicrophoneCapture.stopAudio(processed);

    expect(outputStream.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(inputStream.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(videoTrack.stop).not.toHaveBeenCalled();
    expect(mockProcessorInstances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it('falls back to basic audio when enhanced constraints are unsupported', async () => {
    const stream = mediaStreamWithAudioTrack();
    const unsupportedConstraint = new Error('Unsupported constraint');

    unsupportedConstraint.name = 'OverconstrainedError';

    const mediaDevices = {
      getUserMedia: jest
        .fn()
        .mockRejectedValueOnce(unsupportedConstraint)
        .mockResolvedValueOnce(stream),
    };

    await expect(CallMicrophoneCapture.capture(mediaDevices)).resolves.toBe(
      stream,
    );

    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: true,
      video: false,
    });
  });

  it('does not retry when the user denies microphone permission', async () => {
    const denied = new Error('Permission denied');

    denied.name = 'NotAllowedError';

    const mediaDevices = {
      getUserMedia: jest.fn().mockRejectedValue(denied),
    };

    await expect(CallMicrophoneCapture.capture(mediaDevices)).rejects.toBe(
      denied,
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
