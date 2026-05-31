import { decompressFrames, parseGIF } from 'gifuct-js';

type GifFrameSnapshot = {
  dims: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  disposalType: number;
  restoreData?: ImageData;
};

type AnimatedWebpFrame = {
  chunks: WebpChunk[];
  durationMs: number;
  hasAlpha: boolean;
};

type AnimatedWebpEncodeOptions = {
  drawFrame?: (input: {
    outputCanvas: HTMLCanvasElement;
    sourceCanvas: HTMLCanvasElement;
    sourceHeight: number;
    sourceWidth: number;
  }) => void;
  outputHeight?: number;
  outputWidth?: number;
  quality?: number;
};

type WebpChunk = {
  data: Uint8Array;
  type: string;
};

const webpContentType = 'image/webp';
const defaultWebpQuality = 0.88;
const minimumFrameDelayMs = 20;
const riffHeaderSize = 12;
const chunkHeaderSize = 8;
const webpAnimationFlag = 0x02;
const webpAlphaFlag = 0x10;

export class AnimatedWebpEncoder {
  public async isAnimatedGif(file: File): Promise<boolean> {
    return (await gifFrameCount(file)) > 1;
  }

  public async encodeGif(
    file: File,
    options: AnimatedWebpEncodeOptions = {},
  ): Promise<Blob> {
    const parsed = parseGIF(await file.arrayBuffer());
    const frames = decompressFrames(parsed, true);
    const sourceCanvas = document.createElement('canvas');
    const outputCanvas = document.createElement('canvas');
    const sourceContext = sourceCanvas.getContext('2d');
    const outputContext = outputCanvas.getContext('2d');
    const outputWidth = options.outputWidth ?? parsed.lsd.width;
    const outputHeight = options.outputHeight ?? parsed.lsd.height;
    const webpFrames: AnimatedWebpFrame[] = [];
    let previousFrame: GifFrameSnapshot | null = null;

    if (!sourceContext || !outputContext) {
      throw new Error('Animated WebP conversion failed.');
    }

    sourceCanvas.width = parsed.lsd.width;
    sourceCanvas.height = parsed.lsd.height;
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    for (const frame of frames) {
      applyGifDisposal(sourceContext, previousFrame);

      const restoreData =
        frame.disposalType === 3
          ? sourceContext.getImageData(
              0,
              0,
              sourceCanvas.width,
              sourceCanvas.height,
            )
          : undefined;

      compositeGifPatch(sourceContext, frame.patch, frame.dims);
      outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

      if (options.drawFrame) {
        options.drawFrame({
          outputCanvas,
          sourceCanvas,
          sourceHeight: sourceCanvas.height,
          sourceWidth: sourceCanvas.width,
        });
      } else {
        outputContext.drawImage(sourceCanvas, 0, 0, outputWidth, outputHeight);
      }

      const frameWebp = await canvasToWebpBlob(
        outputCanvas,
        options.quality ?? defaultWebpQuality,
      );
      const chunks = extractAnimatedFrameChunks(
        new Uint8Array(await frameWebp.arrayBuffer()),
      );

      webpFrames.push({
        chunks,
        durationMs: Math.max(minimumFrameDelayMs, frame.delay || 100),
        hasAlpha: chunks.some((chunk) => frameChunkHasAlpha(chunk)),
      });

      previousFrame = {
        dims: frame.dims,
        disposalType: frame.disposalType,
        restoreData,
      };
    }

    return createAnimatedWebpBlob({
      frames: webpFrames,
      height: outputHeight,
      width: outputWidth,
    });
  }
}

function gifFrameCount(file: File): Promise<number> {
  return file
    .arrayBuffer()
    .then((bytes) => decompressFrames(parseGIF(bytes), false).length);
}

function applyGifDisposal(
  context: CanvasRenderingContext2D,
  previousFrame: GifFrameSnapshot | null,
): void {
  if (!previousFrame) return;

  if (previousFrame.disposalType === 2) {
    context.clearRect(
      previousFrame.dims.left,
      previousFrame.dims.top,
      previousFrame.dims.width,
      previousFrame.dims.height,
    );
  }

  if (previousFrame.disposalType === 3 && previousFrame.restoreData) {
    context.putImageData(previousFrame.restoreData, 0, 0);
  }
}

function compositeGifPatch(
  context: CanvasRenderingContext2D,
  patch: Uint8ClampedArray,
  dims: { height: number; left: number; top: number; width: number },
): void {
  const imageData = context.getImageData(
    dims.left,
    dims.top,
    dims.width,
    dims.height,
  );
  const output = imageData.data;

  for (let index = 0; index < patch.length; index += 4) {
    if (patch[index + 3] === 0) continue;

    output[index] = patch[index];
    output[index + 1] = patch[index + 1];
    output[index + 2] = patch[index + 2];
    output[index + 3] = patch[index + 3];
  }

  context.putImageData(imageData, dims.left, dims.top);
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);

          return;
        }

        reject(new Error('Animated WebP frame export failed.'));
      },
      webpContentType,
      quality,
    );
  });
}

function extractAnimatedFrameChunks(bytes: Uint8Array): WebpChunk[] {
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') {
    throw new Error('Canvas did not export a WebP frame.');
  }

  const chunks: WebpChunk[] = [];
  let offset = riffHeaderSize;

  while (offset + chunkHeaderSize <= bytes.length) {
    const type = readAscii(bytes, offset, 4);
    const size = readUint32LE(bytes, offset + 4);
    const dataStart = offset + chunkHeaderSize;
    const dataEnd = dataStart + size;

    if (dataEnd > bytes.length) break;

    if (type === 'VP8 ' || type === 'VP8L' || type === 'ALPH') {
      chunks.push({
        data: bytes.slice(dataStart, dataEnd),
        type,
      });
    }

    offset = dataEnd + (size % 2);
  }

  if (!chunks.some((chunk) => chunk.type === 'VP8 ' || chunk.type === 'VP8L')) {
    throw new Error('WebP frame payload is missing image data.');
  }

  return chunks;
}

function createAnimatedWebpBlob(input: {
  frames: AnimatedWebpFrame[];
  height: number;
  width: number;
}): Blob {
  const hasAlpha = input.frames.some((frame) => frame.hasAlpha);
  const chunks = [
    createChunk('VP8X', createVp8xPayload(input.width, input.height, hasAlpha)),
    createChunk('ANIM', createAnimPayload()),
    ...input.frames.map((frame) =>
      createChunk(
        'ANMF',
        concatBytes([
          createAnmfHeader(input.width, input.height, frame.durationMs),
          ...frame.chunks.map(createWebpChunkBytes),
        ]),
      ),
    ),
  ];
  const payload = concatBytes([
    asciiBytes('WEBP'),
    ...chunks,
  ]);
  const bytes = concatBytes([
    asciiBytes('RIFF'),
    uint32LE(payload.length),
    payload,
  ]);

  return new Blob([bytesToBlobPart(bytes)], { type: webpContentType });
}

function createVp8xPayload(
  width: number,
  height: number,
  hasAlpha: boolean,
): Uint8Array {
  return concatBytes([
    new Uint8Array([
      webpAnimationFlag | (hasAlpha ? webpAlphaFlag : 0),
      0,
      0,
      0,
    ]),
    uint24LE(width - 1),
    uint24LE(height - 1),
  ]);
}

function createAnimPayload(): Uint8Array {
  return new Uint8Array([0, 0, 0, 0, 0, 0]);
}

function createAnmfHeader(
  width: number,
  height: number,
  durationMs: number,
): Uint8Array {
  return concatBytes([
    uint24LE(0),
    uint24LE(0),
    uint24LE(width - 1),
    uint24LE(height - 1),
    uint24LE(durationMs),
    new Uint8Array([0]),
  ]);
}

function createWebpChunkBytes(chunk: WebpChunk): Uint8Array {
  return createChunk(chunk.type, chunk.data);
}

function createChunk(type: string, payload: Uint8Array): Uint8Array {
  return concatBytes([
    asciiBytes(type),
    uint32LE(payload.length),
    payload,
    ...(payload.length % 2 ? [new Uint8Array([0])] : []),
  ]);
}

function frameChunkHasAlpha(chunk: WebpChunk): boolean {
  return chunk.type === 'ALPH' || chunk.type === 'VP8L';
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function uint32LE(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ]);
}

function uint24LE(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
  ]);
}

function bytesToBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
