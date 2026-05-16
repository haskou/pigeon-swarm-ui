declare module 'gifenc' {
  type GifPalette = number[][];

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): {
    bytes: () => Uint8Array;
    bytesView: () => Uint8Array;
    finish: () => void;
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        delay?: number;
        dispose?: number;
        first?: boolean;
        palette?: GifPalette;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ) => void;
  };

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb444' | 'rgb565' | 'rgba4444',
  ): Uint8Array;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
      format?: 'rgb444' | 'rgb565' | 'rgba4444';
      oneBitAlpha?: boolean | number;
    },
  ): GifPalette;
}
