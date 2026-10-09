import { deriveMlsRecordId } from '../../../../../contexts/communities/infrastructure/http/deriveMlsRecordId';

describe('deriveMlsRecordId', () => {
  it('matches the id a real node derived for the same record', () => {
    // Vector taken from a signed POST accepted by pigeon-swarm-node.
    expect(
      deriveMlsRecordId({
        epoch: 1,
        groupId: 'XJUfALmVMkB_S7GPdWVxUsCIGe6dGkvaATuXgWwPLv4',
        kind: 'commit',
        payload: 'b3BhcXVlLWNvbW1pdA==',
      }),
    ).toBe('ADv4Auoc-6kxibwCdzGGJOkrYV6Mhld9eKQAq9Xx-WY');
  });

  it('binds the recipient so a welcome cannot be redirected', () => {
    const base = {
      epoch: 2,
      groupId: 'g',
      kind: 'welcome' as const,
      payload: 'AAEC',
    };

    expect(deriveMlsRecordId({ ...base, recipientIdentityId: 'a' })).not.toBe(
      deriveMlsRecordId({ ...base, recipientIdentityId: 'b' }),
    );
  });
});
