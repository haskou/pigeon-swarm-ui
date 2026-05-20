import type { MessageLinkPreview, Session } from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

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
