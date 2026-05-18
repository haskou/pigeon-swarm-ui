import { ApiUrlBuilder } from './ApiUrlBuilder';
import { HttpJsonError } from './HttpJsonError';

export class HttpJsonClient {
  public constructor(private readonly urls: ApiUrlBuilder) {}

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.urls.build(path), {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: this.headers(init, 'application/json'),
    });

    if (!response.ok) {
      throw await this.error(response);
    }

    if (response.status === 204 || response.status === 304) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  public async requestBlob(
    path: string,
    init: RequestInit = {},
  ): Promise<Blob> {
    const response = await fetch(this.urls.build(path), {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: this.headers(init, '*/*'),
    });

    if (!response.ok) {
      throw await this.error(response);
    }

    return await response.blob();
  }

  private async error(response: Response): Promise<HttpJsonError> {
    const text = await response.text().catch(() => '');

    return new HttpJsonError(response.status, response.statusText, text);
  }

  private headers(init: RequestInit, accept: string): HeadersInit {
    const headers = init.headers ?? {};
    const headerRecord = this.headerRecord(headers);

    return {
      Accept: accept,
      ...(init.body &&
      typeof init.body === 'string' &&
      !this.hasHeader(headers, 'Content-Type')
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headerRecord,
    };
  }

  private headerRecord(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }

    if (Array.isArray(headers)) return Object.fromEntries(headers);

    return headers;
  }

  private hasHeader(headers: HeadersInit, name: string): boolean {
    const normalizedName = name.toLowerCase();

    if (headers instanceof Headers) return headers.has(name);

    if (Array.isArray(headers)) {
      return headers.some(([key]) => key.toLowerCase() === normalizedName);
    }

    return Object.keys(headers).some(
      (key) => key.toLowerCase() === normalizedName,
    );
  }
}
