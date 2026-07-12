import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class CreateLinkPreviewMessage {
  public constructor(
    private readonly input: { session: Session; url: string },
  ) {}

  public getSession(): Session {
    return this.input.session;
  }

  public getUrl(): string {
    return this.input.url;
  }
}
