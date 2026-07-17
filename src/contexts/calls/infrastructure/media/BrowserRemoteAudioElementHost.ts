import type { RemoteAudioElementHost } from './RemoteAudioElementHost';

export class BrowserRemoteAudioElementHost implements RemoteAudioElementHost {
  public create(): HTMLAudioElement {
    return document.createElement('audio');
  }

  public mount(audio: HTMLAudioElement): void {
    document.body.append(audio);
  }
}
