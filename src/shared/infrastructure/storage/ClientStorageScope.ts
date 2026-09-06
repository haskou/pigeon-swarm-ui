import { clientNodeForDocument } from '../client/clientNodeForDocument';
import { isIndependentClient } from '../client/isIndependentClient';

let documentScope: string | undefined;

function getDocumentScope(): string {
  if (documentScope) return documentScope;
  const scope =
    typeof window === 'undefined'
      ? new URL(globalThis.location.href).searchParams.get('pigeonNodeScope')
      : clientNodeForDocument()?.scope;

  if (!scope || !/^[a-f0-9]{64}$/.test(scope))
    throw new Error('Choose a node before opening client storage.');
  documentScope = scope;

  return scope;
}

export function scopeClientStorageKey(key: string): string {
  return isIndependentClient() ? `${key}:${getDocumentScope()}` : key;
}

export function scopeClientWorkerUrl(url: URL): URL {
  const scoped = new URL(url);

  if (isIndependentClient())
    scoped.searchParams.set('pigeonNodeScope', getDocumentScope());

  return scoped;
}
