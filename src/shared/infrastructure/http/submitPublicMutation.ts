import type { PublicMutationPosition } from '../crypto/PublicMutationPosition';
import type { SignedPublicMutation } from '../crypto/SignedPublicMutation';

import { HttpJsonError } from './HttpJsonError';

const MAX_ATTEMPTS = 3;

function currentPosition(error: unknown): PublicMutationPosition | undefined {
  if (!(error instanceof HttpJsonError) || error.status !== 409) {
    return undefined;
  }

  try {
    const body = JSON.parse(error.bodyText) as {
      code?: string;
      details?: { digest?: unknown; sequence?: unknown };
    };
    const { digest, sequence } = body.details ?? {};

    if (
      body.code !== 'StalePublicMutationError' ||
      typeof digest !== 'string' ||
      typeof sequence !== 'number'
    ) {
      return undefined;
    }

    return { predecessor: digest, sequence: sequence + 1 };
  } catch {
    return undefined;
  }
}

/**
 * Submits a signed mutation. A node that already stores a stronger mutation of
 * the record answers with its current position; the intent is then signed
 * again as that mutation's successor so that it supersedes it causally.
 */
export async function submitPublicMutation(
  initial: PublicMutationPosition,
  sign: (position: PublicMutationPosition) => SignedPublicMutation,
  send: (mutation: SignedPublicMutation) => Promise<void>,
): Promise<void> {
  let position = initial;

  for (let attempt = 1; ; attempt += 1) {
    try {
      await send(sign(position));

      return;
    } catch (error) {
      const next = currentPosition(error);

      if (!next || attempt >= MAX_ATTEMPTS) throw error;
      position = next;
    }
  }
}
