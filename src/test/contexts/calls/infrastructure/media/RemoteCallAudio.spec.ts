import { RemoteCallAudio } from '../../../../../contexts/calls/infrastructure/media/RemoteCallAudio';

const originalMediaStream = Object.getOwnPropertyDescriptor(
  globalThis,
  'MediaStream',
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function mediaStream(tracks: MediaStreamTrack[] = []): MediaStream {
  const currentTracks = [...tracks];

  return {
    addTrack: jest.fn((track: MediaStreamTrack) => currentTracks.push(track)),
    getAudioTracks: () => currentTracks,
    getTracks: () => currentTracks,
    removeTrack: jest.fn((track: MediaStreamTrack) => {
      const index = currentTracks.indexOf(track);

      if (index >= 0) currentTracks.splice(index, 1);
    }),
  } as unknown as MediaStream;
}

function audioTrack(id: string): MediaStreamTrack {
  return {
    addEventListener: jest.fn(),
    id,
    kind: 'audio',
  } as unknown as MediaStreamTrack;
}

function audioElement(): HTMLAudioElement {
  return {
    dataset: {},
    pause: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    srcObject: null,
    volume: 1,
  } as unknown as HTMLAudioElement;
}

function remoteCallAudio(
  ...audioElements: HTMLAudioElement[]
): RemoteCallAudio {
  const remainingAudioElements = [...audioElements];

  return new RemoteCallAudio({
    create: jest.fn(() => {
      const audio = remainingAudioElements.shift();

      if (!audio) throw new Error('Missing test audio element.');

      return audio;
    }),
    mount: jest.fn(),
  });
}

function restoreGlobalProperty(
  property: 'MediaStream' | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe(RemoteCallAudio.name, () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'MediaStream', {
      configurable: true,
      value: jest.fn((tracks: MediaStreamTrack[] = []) => mediaStream(tracks)),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreGlobalProperty('MediaStream', originalMediaStream);
    restoreGlobalProperty('window', originalWindow);
  });

  it('mixes remote voice tracks into one playback stream', () => {
    const audio = audioElement();
    const remoteAudio = remoteCallAudio(audio);
    const microphone = audioTrack('microphone');
    const secondaryTrack = audioTrack('secondary-track');

    remoteAudio.playVoiceTrack('peer-id', microphone);
    remoteAudio.playVoiceTrack('peer-id', secondaryTrack);

    expect((audio.srcObject as MediaStream).getAudioTracks()).toEqual([
      microphone,
      secondaryTrack,
    ]);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('keeps voice and screen audio on independent volume channels', () => {
    const voiceAudio = audioElement();
    const screenAudio = audioElement();
    const remoteAudio = remoteCallAudio(voiceAudio, screenAudio);

    remoteAudio.playVoiceTrack('peer-id', audioTrack('microphone'));
    remoteAudio.playScreenTrack('peer-id', audioTrack('screen-audio'));
    remoteAudio.setScreenVolume('peer-id', 0);

    expect(voiceAudio.volume).toBe(1);
    expect(screenAudio.volume).toBe(0);
    expect(voiceAudio.srcObject).not.toBe(screenAudio.srcObject);
  });

  it('uses one Web Audio gain path above native volume', () => {
    const audio = audioElement();
    const gain = {
      connect: jest.fn((destination: AudioNode) => destination),
      gain: { setValueAtTime: jest.fn(), value: 1 },
    } as unknown as GainNode;
    const source = {
      connect: jest.fn((node: AudioNode) => node),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;
    const context = {
      close: jest.fn(() => Promise.resolve()),
      createGain: jest.fn(() => gain),
      createMediaStreamSource: jest.fn(() => source),
      currentTime: 12,
      destination: {} as AudioDestinationNode,
      resume: jest.fn(() => Promise.resolve()),
    } as unknown as AudioContext;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { AudioContext: jest.fn(() => context) },
    });
    const remoteAudio = remoteCallAudio(audio);

    remoteAudio.playVoiceTrack('peer-id', audioTrack('microphone'));
    remoteAudio.setVoiceVolume('peer-id', 250);

    expect(audio.volume).toBe(0);
    expect(context.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(gain.gain.value).toBe(2.5);
  });

  it('mutes and restores a Web Audio gain when deafened', () => {
    const audio = audioElement();
    const gain = {
      connect: jest.fn((destination: AudioNode) => destination),
      gain: { setValueAtTime: jest.fn(), value: 1 },
    } as unknown as GainNode;
    const context = {
      close: jest.fn(() => Promise.resolve()),
      createGain: jest.fn(() => gain),
      createMediaStreamSource: jest.fn(() => ({
        connect: jest.fn((node: AudioNode) => node),
        disconnect: jest.fn(),
      })),
      currentTime: 12,
      destination: {} as AudioDestinationNode,
      resume: jest.fn(() => Promise.resolve()),
    } as unknown as AudioContext;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { AudioContext: jest.fn(() => context) },
    });
    const remoteAudio = remoteCallAudio(audio);

    remoteAudio.playVoiceTrack('peer-id', audioTrack('microphone'));
    remoteAudio.setVoiceVolume('peer-id', 250);
    remoteAudio.setDeafened(true);
    remoteAudio.setDeafened(false);

    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(1, 2.5, 12);
    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(2, 0, 12);
    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(3, 2.5, 12);
  });

  it('removes both playback channels for a departed peer', () => {
    const voiceAudio = audioElement();
    const screenAudio = audioElement();
    const remoteAudio = remoteCallAudio(voiceAudio, screenAudio);

    remoteAudio.playVoiceTrack('peer-id', audioTrack('microphone'));
    remoteAudio.playScreenTrack('peer-id', audioTrack('screen-audio'));
    remoteAudio.removePeer('peer-id');

    expect(voiceAudio.pause).toHaveBeenCalledTimes(1);
    expect(voiceAudio.remove).toHaveBeenCalledTimes(1);
    expect(voiceAudio.srcObject).toBeNull();
    expect(screenAudio.pause).toHaveBeenCalledTimes(1);
    expect(screenAudio.remove).toHaveBeenCalledTimes(1);
    expect(screenAudio.srcObject).toBeNull();
  });
});
