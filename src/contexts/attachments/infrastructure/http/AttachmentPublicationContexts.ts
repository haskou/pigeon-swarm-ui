import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentPublisherExternalIdentifier } from '../../domain/value-objects/AttachmentPublisherExternalIdentifier';
import type { AttachmentSourceExternalIdentifier } from '../../domain/value-objects/AttachmentSourceExternalIdentifier';
import type { AttachmentPublicationContext } from './AttachmentPublicationContext';

import { AttachmentPublicationContextNotFoundError } from './errors/AttachmentPublicationContextNotFoundError';
import { AttachmentPublishedResourceNotFoundError } from './errors/AttachmentPublishedResourceNotFoundError';

export class AttachmentPublicationContexts {
  private readonly contexts = new Map<
    string,
    AttachmentPublicationContext & { publisherExternalIdentifier: string }
  >();

  private readonly publishedResources = new Map<string, MessageAttachment>();

  public register(
    sourceExternalIdentifier: string,
    publisherExternalIdentifier: string,
    context: AttachmentPublicationContext,
  ): void {
    this.contexts.set(sourceExternalIdentifier, {
      ...context,
      publisherExternalIdentifier,
    });
  }

  public discard(sourceExternalIdentifier: string): void {
    this.contexts.delete(sourceExternalIdentifier);
    this.publishedResources.delete(sourceExternalIdentifier);
  }

  public complete(
    sourceExternalIdentifier: AttachmentSourceExternalIdentifier,
    resource: MessageAttachment,
  ): void {
    this.publishedResources.set(sourceExternalIdentifier.toString(), resource);
  }

  public takePublished(sourceExternalIdentifier: string): MessageAttachment {
    const resource = this.publishedResources.get(sourceExternalIdentifier);

    this.publishedResources.delete(sourceExternalIdentifier);

    if (!resource) {
      throw new AttachmentPublishedResourceNotFoundError();
    }

    return resource;
  }

  public take(
    sourceExternalIdentifier: AttachmentSourceExternalIdentifier,
    publisherExternalIdentifier: AttachmentPublisherExternalIdentifier,
  ): AttachmentPublicationContext {
    const source = sourceExternalIdentifier.toString();
    const context = this.contexts.get(source);

    this.contexts.delete(source);

    if (
      !context ||
      context.publisherExternalIdentifier !==
        publisherExternalIdentifier.toString()
    ) {
      throw new AttachmentPublicationContextNotFoundError();
    }

    return {
      file: context.file,
      onProgress: context.onProgress,
      session: context.session,
    };
  }
}
