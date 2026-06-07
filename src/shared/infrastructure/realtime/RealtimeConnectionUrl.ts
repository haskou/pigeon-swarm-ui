import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';

export class RealtimeConnectionUrl {
  public constructor(
    private readonly urls: ApiUrlBuilder = new ApiUrlBuilder(API_SERVER_URL),
  ) {}

  private currentOrigin(): string {
    return globalThis.location?.origin ?? 'http://localhost';
  }

  public path(path: string): string {
    return this.websocket(path).pathname;
  }

  public websocket(path: string): URL {
    const url = new URL(this.urls.build(path), this.currentOrigin());

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url;
  }
}
