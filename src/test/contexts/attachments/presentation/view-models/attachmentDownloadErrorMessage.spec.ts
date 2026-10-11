import { PrivateBlobUnavailableError } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUnavailableError';
import { attachmentDownloadErrorMessage } from '../../../../../contexts/attachments/presentation/view-models/attachmentDownloadErrorMessage';

const copy = {
  errorMessage: 'The attachment could not be decrypted.',
  unavailableMessage: 'This attachment could not be loaded.',
};

describe(attachmentDownloadErrorMessage.name, () => {
  it('shows the unavailable copy when the private blob is gone', () => {
    expect(
      attachmentDownloadErrorMessage(new PrivateBlobUnavailableError(), copy),
    ).toBe(copy.unavailableMessage);
  });

  it('shows the generic copy for other download failures', () => {
    expect(
      attachmentDownloadErrorMessage(new Error('decrypt failed'), copy),
    ).toBe(copy.errorMessage);
    expect(attachmentDownloadErrorMessage('boom', copy)).toBe(
      copy.errorMessage,
    );
  });
});
