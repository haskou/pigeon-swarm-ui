import { AttachmentCipher } from './AttachmentCipher';

describe(AttachmentCipher.name, () => {
  it('converts base64 values to exact array buffers', () => {
    const cipher = new AttachmentCipher();
    const bytes = new Uint8Array(cipher.base64ToArrayBuffer('AQID'));

    expect([...bytes]).toEqual([1, 2, 3]);
  });
});
