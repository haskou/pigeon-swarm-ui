import type { IdentityResource } from './resources/IdentityResource';
import type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';

import { Identity } from '../../domain/Identity';

export class IdentityMapper {
  public fromResource(resource: IdentityResource): Identity {
    return Identity.fromPrimitives({
      createdAt: resource.timestamp,
      id: resource.id,
      networkIds: resource.networks,
      profile: {
        banner: resource.profile.banner ?? undefined,
        biography: resource.profile.biography ?? undefined,
        handle: resource.profile.handle ?? undefined,
        name: resource.profile.name,
        picture: resource.profile.picture ?? undefined,
      },
    });
  }

  public toProfileUpdate(identity: Identity): IdentityUpdateProfileInput {
    const primitives = identity.toPrimitives();

    return {
      ...primitives.profile,
      networks: primitives.networkIds,
    };
  }

  public toResource(
    identity: Identity,
    source: IdentityResource,
  ): IdentityResource {
    const primitives = identity.toPrimitives();

    return {
      ...source,
      id: primitives.id,
      networks: primitives.networkIds,
      profile: {
        ...source.profile,
        ...primitives.profile,
      },
    };
  }
}
