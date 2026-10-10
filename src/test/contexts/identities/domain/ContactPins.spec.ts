import {
  checkContactKey,
  rememberContact,
  unverifyContact,
  verifyContact,
  type ContactPins,
} from '../../../../contexts/identities/domain/ContactPins';

const verifiedAt = '2026-05-01T10:00:00.000Z';

describe('checkContactKey', () => {
  it('reports a pinned identity as verified only after verification', () => {
    const verified: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };
    const remembered: ContactPins = { 'identity-x': { handle: 'bob' } };

    expect(checkContactKey(verified, 'identity-x', 'bob')).toEqual({
      status: 'known',
      verified: true,
    });
    expect(checkContactKey(remembered, 'identity-x', 'bob')).toEqual({
      status: 'known',
      verified: false,
    });
  });

  it('warns when a verified handle now resolves to a different identity', () => {
    const pins: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };

    expect(checkContactKey(pins, 'identity-y', 'bob')).toEqual({
      previousIdentityId: 'identity-x',
      status: 'changed',
      verified: true,
    });
  });

  it('marks a handle change as unverified when the earlier contact was not verified', () => {
    const pins: ContactPins = { 'identity-x': { handle: 'bob' } };

    expect(checkContactKey(pins, 'identity-y', 'bob')).toEqual({
      previousIdentityId: 'identity-x',
      status: 'changed',
      verified: false,
    });
  });

  it('never treats a matching handle as verification of a new identity', () => {
    const pins: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };

    expect(checkContactKey(pins, 'identity-y', 'bob').status).not.toBe('known');
  });

  it('compares handles without case or a leading @', () => {
    const pins: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };

    expect(checkContactKey(pins, 'identity-y', '  @BOB ')).toMatchObject({
      status: 'changed',
    });
  });

  it('treats an unknown identity with an unknown handle as new', () => {
    expect(checkContactKey({}, 'identity-y', 'bob')).toEqual({ status: 'new' });
    expect(checkContactKey({}, 'identity-y')).toEqual({ status: 'new' });
  });
});

describe('rememberContact', () => {
  it('moves a handle to the identity that claimed it and keeps verification of the old one', () => {
    const pins: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };

    const next = rememberContact(pins, 'identity-y', 'bob');

    expect(next).toEqual({
      'identity-x': { verifiedAt },
      'identity-y': { handle: 'bob' },
    });
    expect(checkContactKey(next, 'identity-y', 'bob')).toEqual({
      status: 'known',
      verified: false,
    });
  });

  it('returns the same pins when nothing changes', () => {
    const pins: ContactPins = { 'identity-x': { handle: 'bob' } };

    expect(rememberContact(pins, 'identity-x', 'bob')).toBe(pins);
    expect(rememberContact(pins, 'identity-x')).toBe(pins);
  });
});

describe('verifyContact and unverifyContact', () => {
  it('verifies the identity id and leaves other verified contacts intact', () => {
    const pins: ContactPins = {
      'identity-z': { verifiedAt },
    };

    const verified = verifyContact(
      pins,
      'identity-x',
      '2026-06-01T00:00:00.000Z',
      'bob',
    );

    expect(verified).toEqual({
      'identity-x': {
        handle: 'bob',
        verifiedAt: '2026-06-01T00:00:00.000Z',
      },
      'identity-z': { verifiedAt },
    });
  });

  it('keeps the remembered handle when verification is removed', () => {
    const pins: ContactPins = {
      'identity-x': { handle: 'bob', verifiedAt },
    };

    expect(unverifyContact(pins, 'identity-x')).toEqual({
      'identity-x': { handle: 'bob' },
    });
  });

  it('forgets a verified identity that has no handle once verification is removed', () => {
    const pins: ContactPins = { 'identity-x': { verifiedAt } };

    expect(unverifyContact(pins, 'identity-x')).toEqual({});
  });
});
