import type {
  MessageLinkPreview,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/httpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/requestSigner';

export class PigeonLinkPreviewsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async create(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    const path = '/link-previews';
    const body = { url };

    return await this.http.request<MessageLinkPreview>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }
}
