import type { ScreenShareQualityPreset } from './ScreenShareQualityPreset';

export type ScreenShareOptions = {
  audioEnabled: boolean;
  quality?: ScreenShareQualityPreset;
};
