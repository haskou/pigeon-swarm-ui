import { ApiUrlBuilder } from './ApiUrlBuilder';
import { HttpJsonError } from './HttpJsonError';

export class HttpJsonClient {
  public constructor(private readonly urls: ApiUrlBuilder) {}

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.urls.build(path), {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: this.headers(init),
    });

    if (!response.ok) {
      throw await this.error(response);
    }

    if (response.status === 204 || response.status === 304) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async error(response: Response): Promise<HttpJsonError> {
    const text = await response.text().catch(() => '');

    return new HttpJsonError(response.status, response.statusText, text);
  }

  private headers(init: RequestInit): HeadersInit {
    return {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    };
  }
}
