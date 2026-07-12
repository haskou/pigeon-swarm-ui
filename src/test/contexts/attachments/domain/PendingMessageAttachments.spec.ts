import { PendingMessageAttachments } from '../../../../contexts/attachments/domain/PendingMessageAttachments';

describe(PendingMessageAttachments.name, () => {
  it('keeps the local file so pending image bubbles can render immediately', () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });

    expect(PendingMessageAttachments.fromFiles([file], 'message-1')).toEqual([
      expect.objectContaining({
        cid: 'message-1:pending-attachment:0',
        contentType: 'image/png',
        localFile: file,
        size: file.size,
        type: 'chunked_file',
      }),
    ]);
  });
});
