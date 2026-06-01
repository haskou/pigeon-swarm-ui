import {
  screenShareEncodingParameters,
  screenShareTrackConstraints,
  screenShareVideoConstraints,
} from './ScreenShareQuality';

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
});
