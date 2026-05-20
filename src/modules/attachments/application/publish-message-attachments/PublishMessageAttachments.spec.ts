import type {
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PublishMessageAttachmentsPort } from '../ports/PublishMessageAttachmentsPort';

import { PublishMessageAttachmentsMessage } from './messages/PublishMessageAttachmentsMessage';
import { PublishMessageAttachments } from './PublishMessageAttachments';

describe(PublishMessageAttachments.name, () => {
  it('publishes attachments through the explicit application message', async () => {
    const attachment = {
      cid: 'bafy-attachment',
      contentType: 'image/png',
      filename: 'image.png',
      size: 123,
    } satisfies MessageAttachment;
    const port: PublishMessageAttachmentsPort = {
      publish: jest.fn().mockResolvedValue([attachment]),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const file = new File(['content'], 'image.png', { type: 'image/png' });
    const progress = jest.fn();
    const message = new PublishMessageAttachmentsMessage({
      attachments: [file],
      onProgress: progress,
      options: { encryptLargeAttachments: true },
      session,
    });

    await expect(
      new PublishMessageAttachments(port).publish(message),
    ).resolves.toEqual([attachment]);

    expect(port.publish).toHaveBeenCalledWith(message);
    expect(message.getSession()).toBe(session);
    expect(message.getAttachments()).toEqual([file]);
    expect(message.getProgressReporter()).toBe(progress);
    expect(message.getOptions()).toEqual({ encryptLargeAttachments: true });
  });
});
