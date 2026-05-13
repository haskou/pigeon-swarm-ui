const notificationSoundUrl = '/notification.mp3';

export const incomingCallSoundUrl = '/inputCallSong.mp3';

let notificationAudio: HTMLAudioElement | null = null;

export function playNotificationSound(): void {
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundUrl);
    notificationAudio.preload = 'auto';
  }

  notificationAudio.currentTime = 0;
  void notificationAudio.play().catch(() => undefined);
}
