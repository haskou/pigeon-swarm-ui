import type { ScreenShareQualityPreset } from '../../domain/callSession.types';

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
  auto: {
    preset: 'auto',
  },
};

export const screenShareQualityPresets: ScreenShareQualityPreset[] = [
  'auto',
  '1080p30',
  '1080p60',
  '1440p30',
  '1440p60',
];

export function screenShareQualityLabel(
  preset: ScreenShareQualityPreset,
): string {
  if (preset === 'auto') return 'Auto';

  if (preset === '1080p30') return '1080p 30fps';

  if (preset === '1080p60') return '1080p 60fps';

  if (preset === '1440p30') return '2K 30fps';

  return '2K 60fps';
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
