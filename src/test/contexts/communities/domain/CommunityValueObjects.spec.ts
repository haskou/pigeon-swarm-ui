import { CommunityChannelNameRequiredError } from '../../../../contexts/communities/domain/errors/CommunityChannelNameRequiredError';
import { CommunityIdentityIdRequiredError } from '../../../../contexts/communities/domain/errors/CommunityIdentityIdRequiredError';
import { CommunityIdRequiredError } from '../../../../contexts/communities/domain/errors/CommunityIdRequiredError';
import { CommunityNameRequiredError } from '../../../../contexts/communities/domain/errors/CommunityNameRequiredError';
import { CommunityNetworkIdRequiredError } from '../../../../contexts/communities/domain/errors/CommunityNetworkIdRequiredError';
import { CommunityRoleNameRequiredError } from '../../../../contexts/communities/domain/errors/CommunityRoleNameRequiredError';
import { CommunityChannelName } from '../../../../contexts/communities/domain/value-objects/CommunityChannelName';
import { CommunityId } from '../../../../contexts/communities/domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityName } from '../../../../contexts/communities/domain/value-objects/CommunityName';
import { CommunityNetworkId } from '../../../../contexts/communities/domain/value-objects/CommunityNetworkId';
import { CommunityRoleName } from '../../../../contexts/communities/domain/value-objects/CommunityRoleName';

describe('community required values', () => {
  it.each([
    [CommunityChannelName, CommunityChannelNameRequiredError],
    [CommunityId, CommunityIdRequiredError],
    [CommunityIdentityId, CommunityIdentityIdRequiredError],
    [CommunityName, CommunityNameRequiredError],
    [CommunityNetworkId, CommunityNetworkIdRequiredError],
    [CommunityRoleName, CommunityRoleNameRequiredError],
  ])('rejects an empty %p with %p', (ValueObject, ExpectedError) => {
    expect(() => ValueObject.fromString('   ')).toThrow(ExpectedError);
  });

  it('normalizes PEM identity identifiers at the boundary', () => {
    const identityId = CommunityIdentityId.fromString(
      '-----BEGIN PUBLIC KEY-----\nidentity-a\n-----END PUBLIC KEY-----',
    );

    expect(
      identityId.isEqual(CommunityIdentityId.fromString('identity-a')),
    ).toBe(true);
  });
});
