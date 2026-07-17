import type { IdentityPresenceResource } from './resources/IdentityPresenceResource';
import type { PresenceStatusResource } from './resources/PresenceStatusResource';
import type { SelectablePresenceStatusResource } from './resources/SelectablePresenceStatusResource';

import { IdentityPresence } from '../../domain/IdentityPresence';
import { DisconnectedIdentityPresenceMappingError } from './errors/DisconnectedIdentityPresenceMappingError';
import { InvalidIdentityPresenceStatusMappingError } from './errors/InvalidIdentityPresenceStatusMappingError';

function presenceStatusResourceFrom(status: string): PresenceStatusResource {
  switch (status) {
    case 'available':
    case 'away':
    case 'busy':
    case 'disconnected':
    case 'invisible':
      return status;
    default:
      throw new InvalidIdentityPresenceStatusMappingError(status);
  }
}

export class IdentityPresenceMapper {
  public fromResource(resource: IdentityPresenceResource): IdentityPresence {
    return IdentityPresence.fromPrimitives({
      identityId: resource.identityId,
      lastActivityAt: resource.lastActivityAt,
      lastHeartbeatAt: resource.lastHeartbeatAt,
      networkIds: resource.networkIds ?? [],
      status: resource.status,
      updatedAt: resource.updatedAt,
    });
  }

  public toResource(presence: IdentityPresence): IdentityPresenceResource {
    const primitives = presence.toPrimitives();

    return {
      ...primitives,
      status: presenceStatusResourceFrom(primitives.status),
    };
  }

  public toSelectableStatus(
    presence: IdentityPresence,
  ): SelectablePresenceStatusResource {
    const status = this.toResource(presence).status;

    if (status === 'disconnected') {
      throw new DisconnectedIdentityPresenceMappingError();
    }

    return status;
  }
}
