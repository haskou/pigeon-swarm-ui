import { ClientNodeEndpoint } from '../../../../shared/infrastructure/client/ClientNodeEndpoint';

export type PendingRegistrationLink = {
  code: string;
  node: string;
};

const REGISTRATION_PATH = '/register';
const NODE_PARAMETER = 'node';
const CODE_PARAMETER = 'code';
const codePattern = /^[A-Za-z0-9_-]{43}$/;

/**
 * The registration link lives in memory only: it is captured and wiped from
 * the address bar before anything else runs, and forgotten once sign-up no
 * longer needs it. The code never reaches storage, logs or a request URL.
 */
let pending: PendingRegistrationLink | null = null;

/** The node endpoint a link names, from the API base this page talks to. */
function nodeEndpointFrom(apiBase: string): string {
  return ClientNodeEndpoint.normalize(
    new URL(apiBase, window.location.href).href,
  );
}

export function createRegistrationUrl(input: {
  code: string;
  node: string;
}): string {
  const node = encodeURIComponent(nodeEndpointFrom(input.node));

  return `${window.location.origin}${REGISTRATION_PATH}#${NODE_PARAMETER}=${node}&${CODE_PARAMETER}=${input.code}`;
}

/** Reads a `/register` link and clears it from the address bar at once. */
export function captureRegistrationLink(): void {
  const url = new URL(window.location.href);

  if (url.pathname.replace(/\/+$/, '') !== REGISTRATION_PATH) return;

  window.history.replaceState({}, document.title, '/');
  pending = parseRegistrationFragment(url.hash);
}

export function pendingRegistrationLink(): PendingRegistrationLink | null {
  return pending;
}

export function isRegistrationLinkFor(
  link: PendingRegistrationLink,
  apiBase: string,
): boolean {
  try {
    return link.node === nodeEndpointFrom(apiBase);
  } catch {
    return false;
  }
}

export function forgetRegistrationLink(): void {
  pending = null;
}

function parseRegistrationFragment(
  hash: string,
): PendingRegistrationLink | null {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  const code = parameters.get(CODE_PARAMETER) ?? '';
  const node = parameters.get(NODE_PARAMETER) ?? '';

  if (!codePattern.test(code) || !node) return null;

  try {
    return { code, node: ClientNodeEndpoint.normalize(node) };
  } catch {
    return null;
  }
}
