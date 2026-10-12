import type { Session } from '../../../identities/infrastructure/session/Session';
import type { PublicFileUpload } from '../../application/contracts/PublicFileUpload';

import { PublicImageUploadPreparer } from '../media/PublicImageUploadPreparer';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';

export class PigeonPublicFileUploader {
  public constructor(
    private readonly files: PigeonPublicFilesClient,
    private readonly images: PublicImageUploadPreparer,
  ) {}

  public async upload(session: Session, file: File): Promise<PublicFileUpload> {
    const prepared = await this.images.prepare(file);

    return await this.files.upload(
      session,
      await prepared.arrayBuffer(),
      prepared.name || 'upload',
      prepared.type || 'application/octet-stream',
    );
  }
}
