import { ClientNodeEndpoint } from './ClientNodeEndpoint';

export class MailboxHomeOrigin {
  private static isNonPublicHost(hostname: string): boolean {
    if (hostname === 'localhost') {
      return false;
    }

    if (hostname.startsWith('[')) {
      return MailboxHomeOrigin.isNonPublicIpv6(hostname.slice(1, -1));
    }

    const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(hostname);

    return (
      ipv4 !== null &&
      MailboxHomeOrigin.isNonPublicIpv4(Number(ipv4[1]), Number(ipv4[2]))
    );
  }

  private static isNonPublicIpv4(first: number, second: number): boolean {
    return (
      [0, 10, 127].includes(first) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  private static isNonPublicIpv6(address: string): boolean {
    return (
      address === '::' ||
      address === '::1' ||
      address.startsWith('::ffff:') ||
      /^fe[89ab]/.test(address) ||
      /^f[cd]/.test(address)
    );
  }

  /**
   * Origin a node may advertise as its mailbox home. Undefined when the node
   * is path-prefixed, the endpoint is invalid, or its host is private, loopback
   * or link-local. The localhost name is the only dev exception.
   */
  public static fromNodeEndpoint(endpoint: string): string | undefined {
    try {
      const url = new URL(ClientNodeEndpoint.normalize(endpoint));

      return url.pathname === '/' &&
        !MailboxHomeOrigin.isNonPublicHost(url.hostname)
        ? url.origin
        : undefined;
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
