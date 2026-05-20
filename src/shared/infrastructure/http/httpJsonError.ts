export class HttpJsonError extends Error {
  public readonly code?: number | string;

  public readonly status: number;

  public constructor(
    status: number,
    statusText: string,
    public readonly bodyText: string,
  ) {
    const details = bodyText ? ` · ${bodyText}` : '';

    super(`${status} ${statusText}${details}`);
    this.name = HttpJsonError.name;
    this.status = status;
    this.code = this.parseCode(bodyText);
  }

  private parseCode(bodyText: string): number | string | undefined {
    try {
      const body = JSON.parse(bodyText) as { code?: number | string };

      return body.code;
    } catch {
      return undefined;
    }
  }
}
