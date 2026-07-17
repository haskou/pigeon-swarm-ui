import type { ScreenShareQualityPreset } from './ScreenShareQualityPreset';

type ScreenShareQualityProfile = {
  frameRate?: number;
  height?: number;
  maxBitrate?: number;
  preset: ScreenShareQualityPreset;
  width?: number;
};

const screenShareQualityProfiles: Record<
  ScreenShareQualityPreset,
  ScreenShareQualityProfile
> = {
  '720p30': {
    frameRate: 30,
    height: 720,
    maxBitrate: 2_500_000,
    preset: '720p30',
    width: 1280,
  },
  '720p60': {
    frameRate: 60,
    height: 720,
    maxBitrate: 4_000_000,
    preset: '720p60',
    width: 1280,
  },
  '1080p30': {
    frameRate: 30,
    height: 1080,
    maxBitrate: 5_000_000,
    preset: '1080p30',
    width: 1920,
  },
  '1080p60': {
    frameRate: 60,
    height: 1080,
    maxBitrate: 8_000_000,
    preset: '1080p60',
    width: 1920,
  },
  '1440p30': {
    frameRate: 30,
    height: 1440,
    maxBitrate: 8_000_000,
    preset: '1440p30',
    width: 2560,
  },
  '1440p60': {
    frameRate: 60,
    height: 1440,
    maxBitrate: 12_000_000,
    preset: '1440p60',
    width: 2560,
  },
  '2160p30': {
    frameRate: 30,
    height: 2160,
    maxBitrate: 20_000_000,
    preset: '2160p30',
    width: 3840,
  },
  '2160p60': {
    frameRate: 60,
    height: 2160,
    maxBitrate: 35_000_000,
    preset: '2160p60',
    width: 3840,
  },
  auto: {
    preset: 'auto',
  },
};

export const screenShareQualityPresets: ScreenShareQualityPreset[] = [
  'auto',
  '720p30',
  '720p60',
  '1080p30',
  '1080p60',
  '1440p30',
  '1440p60',
  '2160p30',
  '2160p60',
];

const screenShareQualityLabels: Record<ScreenShareQualityPreset, string> = {
  '720p30': '720p 30fps',
  '720p60': '720p 60fps',
  '1080p30': '1080p 30fps',
  '1080p60': '1080p 60fps',
  '1440p30': '2K 30fps',
  '1440p60': '2K 60fps',
  '2160p30': '4K 30fps',
  '2160p60': '4K 60fps',
  auto: 'Auto',
};

export function screenShareQualityLabel(
  preset: ScreenShareQualityPreset,
): string {
  return screenShareQualityLabels[preset];
}

export function screenShareVideoConstraints(
  preset: ScreenShareQualityPreset,
): MediaTrackConstraints | true {
  const profile = screenShareQualityProfiles[preset];

  if (profile.preset === 'auto') return true;

  return {
    frameRate: { ideal: profile.frameRate, max: profile.frameRate },
    height: { ideal: profile.height },
    width: { ideal: profile.width },
  };
}

export function screenShareTrackConstraints(
  preset: ScreenShareQualityPreset,
): MediaTrackConstraints {
  const constraints = screenShareVideoConstraints(preset);

  return constraints === true ? {} : constraints;
}

export function screenShareEncodingParameters(
  preset: ScreenShareQualityPreset,
): Partial<RTCRtpEncodingParameters> {
  const profile = screenShareQualityProfiles[preset];

  return {
    maxBitrate: profile.maxBitrate,
    maxFramerate: profile.frameRate,
  };
}
