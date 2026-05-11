import { ApiUrlBuilder } from './ApiUrlBuilder';

export class HttpJsonClient {
  public constructor(private readonly urls: ApiUrlBuilder) {}

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.urls.build(path), {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: this.headers(init),
    });

    if (!response.ok) {
      throw new Error(await this.errorMessage(response));
    }

    if (response.status === 204 || response.status === 304) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async errorMessage(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    const details = text ? ` · ${text}` : '';

    return `${response.status} ${response.statusText}${details}`;
  }

  private headers(init: RequestInit): HeadersInit {
    return {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    };
  }
}
