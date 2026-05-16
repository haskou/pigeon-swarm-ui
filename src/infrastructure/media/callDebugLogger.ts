/* eslint-disable no-console */

type CallDebugContext = Record<string, unknown>;

const prefix = '[pigeon:calls]';

export function logCallDebug(
  event: string,
  context: CallDebugContext = {},
): void {
  console.debug(prefix, event, context);
}

export function logCallWarning(
  event: string,
  context: CallDebugContext = {},
): void {
  console.warn(prefix, event, context);
}

export function logCallError(
  event: string,
  error: unknown,
  context: CallDebugContext = {},
): void {
  console.error(prefix, event, { ...context, error });
}
