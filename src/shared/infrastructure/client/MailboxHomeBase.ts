import { ClientNodeEndpoint } from './ClientNodeEndpoint';

export class MailboxHomeBase {
  private static readonly MAX_LENGTH = 255;

  private static isNonPublicHost(hostname: string): boolean {
    if (hostname === 'localhost') {
      return false;
    }

    if (hostname.startsWith('[')) {
      return MailboxHomeBase.isNonPublicIpv6(hostname.slice(1, -1));
    }

    const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(hostname);

    return (
      ipv4 !== null &&
      MailboxHomeBase.isNonPublicIpv4(Number(ipv4[1]), Number(ipv4[2]))
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

  /** Canonical base of an absolute URL, or undefined if not publishable. */
  private static canonicalOf(absolute: string): string | undefined {
    try {
      const canonical = ClientNodeEndpoint.normalize(absolute);
      const url = new URL(canonical);

      return canonical.length <= MailboxHomeBase.MAX_LENGTH &&
        !url.pathname.includes('//') &&
        !MailboxHomeBase.isNonPublicHost(url.hostname)
        ? canonical
        : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Base URL a node may advertise as its mailbox home: the API base this client
   * uses, made absolute against the page origin, with one trailing slash
   * dropped.
   * Undefined for query, fragment, credentials, non-https (loopback http is the
   * exception), or a private or link-local host. The localhost name is the only
   * dev exception.
   */
  public static fromApiBase(
    apiBase: string,
    pageOrigin: string,
  ): string | undefined {
    if (/[?#@]/.test(apiBase)) {
      return undefined;
    }

    try {
      return MailboxHomeBase.canonicalOf(new URL(apiBase, pageOrigin).href);
    } catch {
      return undefined;
    }
  }

  /** Accepts only the exact canonical base form the node signs. */
  public static parse(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return MailboxHomeBase.canonicalOf(value) === value ? value : undefined;
  }
}
