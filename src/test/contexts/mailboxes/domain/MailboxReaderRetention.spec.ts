import { MailboxReaderRetention } from '../../../../contexts/mailboxes/domain/MailboxReaderRetention';

describe('MailboxReaderRetention', () => {
  const retained = ['root', 'device'];
  const devices = ['device-a', 'device-b'];

  it('removes every listed reader no retained or device set holds', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        listed: ['root', 'device-a', 'identity-root', 'stale'],
        retained,
      }),
    ).toEqual(['identity-root', 'stale']);
  });

  it('never removes retained or device readers', () => {
    expect(
      MailboxReaderRetention.readersToRemove({
        devices,
        listed: ['root', 'device', 'device-a', 'device-b'],
        retained,
      }),
    ).toEqual([]);
  });
});
