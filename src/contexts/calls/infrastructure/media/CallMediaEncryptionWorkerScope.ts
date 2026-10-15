import type { CallMediaScriptTransformer } from './CallMediaScriptTransformer';

/** The dedicated worker scope that encrypts call media. */
export type CallMediaEncryptionWorkerScope = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onrtctransform:
    | ((event: { readonly transformer: CallMediaScriptTransformer }) => void)
    | null;
};
