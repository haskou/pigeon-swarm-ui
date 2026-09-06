export class ClientNodeEndpoint {
  public static normalize(value: string): string {
    const url = new URL(value.trim());
    const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);

    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      [url.username, url.password, url.search, url.hash].some(Boolean) ||
      !/^\/[a-zA-Z0-9_./-]*$/.test(url.pathname)
    ) {
      throw new Error(
        'Enter an HTTPS node URL, without credentials, query or fragment.',
      );
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }
}
