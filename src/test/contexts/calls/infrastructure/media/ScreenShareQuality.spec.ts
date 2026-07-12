import {
  screenShareEncodingParameters,
  screenShareTrackConstraints,
  screenShareVideoConstraints,
} from '../../../../../contexts/calls/infrastructure/media/ScreenShareQuality';

describe('ScreenShareQuality', () => {
  it('keeps auto capture unconstrained', () => {
    expect(screenShareVideoConstraints('auto')).toBe(true);
    expect(screenShareTrackConstraints('auto')).toEqual({});
    expect(screenShareEncodingParameters('auto')).toEqual({
      maxBitrate: undefined,
      maxFramerate: undefined,
    });
  });

  it('maps 2K 60fps to capture and sender limits', () => {
    expect(screenShareVideoConstraints('1440p60')).toEqual({
      frameRate: { ideal: 60, max: 60 },
      height: { ideal: 1440 },
      width: { ideal: 2560 },
    });
    expect(screenShareEncodingParameters('1440p60')).toEqual({
      maxBitrate: 12_000_000,
      maxFramerate: 60,
    });
  });

  it('maps 720p 30fps to capture and sender limits', () => {
    expect(screenShareVideoConstraints('720p30')).toEqual({
      frameRate: { ideal: 30, max: 30 },
      height: { ideal: 720 },
      width: { ideal: 1280 },
    });
    expect(screenShareEncodingParameters('720p30')).toEqual({
      maxBitrate: 2_500_000,
      maxFramerate: 30,
    });
  });

  it('maps 4K 60fps to capture and sender limits', () => {
    expect(screenShareVideoConstraints('2160p60')).toEqual({
      frameRate: { ideal: 60, max: 60 },
      height: { ideal: 2160 },
      width: { ideal: 3840 },
    });
    expect(screenShareEncodingParameters('2160p60')).toEqual({
      maxBitrate: 35_000_000,
      maxFramerate: 60,
    });
  });
});
