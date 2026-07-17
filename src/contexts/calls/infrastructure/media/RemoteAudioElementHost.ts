export type RemoteAudioElementHost = {
  create(): HTMLAudioElement;
  mount(audio: HTMLAudioElement): void;
};
