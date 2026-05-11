export class ApiUrlBuilder {
  private readonly baseUrl: string;

  public static trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '');
  }

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public build(path: string): string {
    const cleanBase = this.baseUrl.endsWith('/')
      ? this.baseUrl
      : `${this.baseUrl}/`;
    const cleanPath = ApiUrlBuilder.trimSlashes(path);

    return `${cleanBase}${cleanPath}`;
  }
}
