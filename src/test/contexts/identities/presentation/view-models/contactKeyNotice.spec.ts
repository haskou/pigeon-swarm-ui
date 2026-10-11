import {
  contactKeyBlocked,
  contactKeyNotice,
} from '../../../../../contexts/identities/presentation/view-models/contactKeyNotice';

describe('contactKeyNotice', () => {
  it('stays silent for new and known contacts', () => {
    expect(contactKeyNotice({ status: 'new' })).toBe('none');
    expect(contactKeyNotice({ status: 'known', verified: false })).toBe('none');
    expect(contactKeyNotice({ status: 'known', verified: true })).toBe('none');
    expect(contactKeyNotice(null)).toBe('none');
  });

  it('shows a plain note when an unverified handle now resolves elsewhere', () => {
    expect(
      contactKeyNotice({
        previousIdentityId: 'identity-old',
        status: 'changed',
        verified: false,
      }),
    ).toBe('unverified-change');
  });

  it('requires acknowledgement when a previously verified handle changed', () => {
    expect(
      contactKeyNotice({
        previousIdentityId: 'identity-old',
        status: 'changed',
        verified: true,
      }),
    ).toBe('verified-change');
  });
});

describe('contactKeyBlocked', () => {
  const verifiedChange = {
    previousIdentityId: 'identity-old',
    status: 'changed' as const,
    verified: true,
  };

  it('never blocks submission for silent or plain-note cases', () => {
    expect(contactKeyBlocked({ status: 'new' }, false)).toBe(false);
    expect(
      contactKeyBlocked(
        {
          previousIdentityId: 'identity-old',
          status: 'changed',
          verified: false,
        },
        false,
      ),
    ).toBe(false);
  });

  it('blocks a previously verified change until it is acknowledged', () => {
    expect(contactKeyBlocked(verifiedChange, false)).toBe(true);
    expect(contactKeyBlocked(verifiedChange, true)).toBe(false);
  });

  it('treats a missing check as not blocking', () => {
    expect(contactKeyBlocked(null, false)).toBe(false);
  });
});
