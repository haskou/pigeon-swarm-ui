/**
 * The media key of a private call in one key epoch: the base64 call key and
 * its epoch, the MLS epoch the community group exported it in, or 0 for the
 * conversation key. A newer epoch replaces the key during the call.
 */
export type CallMediaKey = { readonly epoch: number; readonly key: string };
