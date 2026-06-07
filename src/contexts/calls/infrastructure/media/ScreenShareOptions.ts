import type { ScreenShareQualityPreset } from '../../domain/callSession.types';

export type ScreenShareOptions = {
  audioEnabled: boolean;
  quality?: ScreenShareQualityPreset;
};
