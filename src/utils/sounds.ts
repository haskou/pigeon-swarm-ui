const notificationSoundUrl = '/notification.mp3';

export const answeredCallSoundUrl = '/call-answered.mp3';
export const dialingCallSoundUrl = '/call-dialing.mp3';
export const endedCallSoundUrl = '/call-ended.mp3';
export const incomingCallSoundUrl = '/call-incoming.mp3';

let notificationAudio: HTMLAudioElement | null = null;
let answeredCallAudio: HTMLAudioElement | null = null;

export function playNotificationSound(): void {
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundUrl);
    notificationAudio.preload = 'auto';
  }

  notificationAudio.currentTime = 0;
  void notificationAudio.play().catch(() => undefined);
}

export function playAnsweredCallSound(): void {
  if (!answeredCallAudio) {
    answeredCallAudio = new Audio(answeredCallSoundUrl);
    answeredCallAudio.preload = 'auto';
  }

  answeredCallAudio.currentTime = 0;
  void answeredCallAudio.play().catch(() => undefined);
}
