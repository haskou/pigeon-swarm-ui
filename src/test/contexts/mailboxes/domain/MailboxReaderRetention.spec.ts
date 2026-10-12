import { MailboxReaderRetention } from '../../../../contexts/mailboxes/domain/MailboxReaderRetention';

describe('MailboxReaderRetention', () => {
  const retained = ['managing', 'root', 'device', 'sealed'];
  const devices = ['device-a', 'device-b'];
  const legacy = ['legacy-root', 'legacy-device-a', 'legacy-device-b'];

  it('removes a listed reader that no retained, device or legacy set holds', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        legacy,
        listed: ['managing', 'device-a', 'stale'],
        retained,
      }),
    ).toEqual(['stale']);
  });

  it('keeps the legacy readers while a device reader is not listed yet', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        legacy,
        listed: ['device-a', 'legacy-root', 'legacy-device-a', 'stale'],
        retained,
      }),
    ).toEqual(['stale']);
  });

  it('drops the legacy readers once every device reader is listed', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        legacy,
        listed: ['device-a', 'device-b', 'legacy-root', 'legacy-device-a'],
        retained,
      }),
    ).toEqual(['legacy-root', 'legacy-device-a']);
  });

  it('never removes retained or device readers', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        legacy,
        listed: ['managing', 'root', 'device', 'sealed', 'device-a'],
        retained,
      }),
    ).toEqual([]);
  });
});
