import { PendingMessageAttachments } from '../../../../../contexts/attachments/presentation/view-models/PendingMessageAttachments';

describe(PendingMessageAttachments.name, () => {
  it('projects local files as pending timeline attachments', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    expect(PendingMessageAttachments.fromFiles([file], 'message-1')).toEqual([
      expect.objectContaining({
        cid: 'message-1:pending-attachment:0',
        contentType: 'text/plain',
        encrypted: true,
        filename: 'hello.txt',
        localFile: file,
        size: file.size,
      }),
    ]);
  });
});
