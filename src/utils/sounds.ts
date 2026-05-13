const notificationSoundUrl = '/sounds/notification.mp3';

export const answeredCallSoundUrl = '/sounds/call-answered.mp3';
export const declinedCallSoundUrl = '/sounds/call-declined.mp3';
export const dialingCallSoundUrl = '/sounds/call-dialing.mp3';
export const endedCallSoundUrl = '/sounds/call-ended.mp3';
export const incomingCallSoundUrl = '/sounds/call-incoming.mp3';

let notificationAudio: HTMLAudioElement | null = null;
let answeredCallAudio: HTMLAudioElement | null = null;
let endedCallAudio: HTMLAudioElement | null = null;
let incomingCallAudio: HTMLAudioElement | null = null;

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

export function playEndedCallSound(): void {
  if (!endedCallAudio) {
    endedCallAudio = new Audio(endedCallSoundUrl);
    endedCallAudio.preload = 'auto';
  }

  endedCallAudio.currentTime = 0;
  void endedCallAudio.play().catch(() => undefined);
}

export function playIncomingCallSound(): void {
  if (!incomingCallAudio) {
    incomingCallAudio = new Audio(incomingCallSoundUrl);
    incomingCallAudio.loop = true;
    incomingCallAudio.preload = 'auto';
    incomingCallAudio.volume = 0.45;
  }

  incomingCallAudio.currentTime = 0;
  void incomingCallAudio.play().catch(() => undefined);
}

export function stopIncomingCallSound(): void {
  if (!incomingCallAudio) return;

  incomingCallAudio.pause();
  incomingCallAudio.currentTime = 0;
}
