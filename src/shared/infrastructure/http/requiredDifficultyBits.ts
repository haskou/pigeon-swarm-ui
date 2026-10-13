import { HttpJsonError } from './HttpJsonError';

/**
 * A node 400 body may name the proof-of-work difficulty a request must meet.
 * Only a positive safe integer counts; anything else yields undefined.
 */
export function requiredDifficultyBits(error: unknown): number | undefined {
  if (!(error instanceof HttpJsonError) || error.status !== 400) {
    return undefined;
  }

  try {
    const body = JSON.parse(error.bodyText) as {
      requiredDifficultyBits?: unknown;
    } | null;
    const bits = body?.requiredDifficultyBits;

    return typeof bits === 'number' && Number.isSafeInteger(bits) && bits > 0
      ? bits
      : undefined;
  } catch {
    return undefined;
  }
}
