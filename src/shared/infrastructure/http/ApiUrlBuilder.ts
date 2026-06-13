export class ApiUrlBuilder {
  private readonly baseUrl: string;

  public static trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '');
  }

  public static normalizePath(value: string): string {
    return `/${value.replace(/^\/+/, '')}`;
  }

  public static normalizePrefix(value: string): string {
    const normalized = ApiUrlBuilder.normalizePath(value).replace(/\/+$/g, '');

    return normalized === '/' ? '' : normalized;
  }

  public static pathPrefix(baseUrl: string): string {
    if (!baseUrl.trim()) return '';

    return ApiUrlBuilder.normalizePrefix(
      new URL(baseUrl, 'http://localhost').pathname,
    );
  }

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public build(path: string): string {
    const cleanBase = this.baseUrl.endsWith('/')
      ? this.baseUrl
      : `${this.baseUrl}/`;
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBase}${cleanPath}`;
  }
}
