import { ClientNodeEndpoint } from './ClientNodeEndpoint';

export class MailboxHomeOrigin {
  /**
   * Origin a node may advertise as its mailbox home. Undefined when the node
   * is path-prefixed or the endpoint is invalid.
   */
  public static fromNodeEndpoint(endpoint: string): string | undefined {
    try {
      const url = new URL(ClientNodeEndpoint.normalize(endpoint));

      return url.pathname === '/' ? url.origin : undefined;
    } catch {
      return undefined;
    }
  }

  /** Accepts only the exact origin form the node signs. Anything else drops. */
  public static parse(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return MailboxHomeOrigin.fromNodeEndpoint(value) === value
      ? value
      : undefined;
  }
}
