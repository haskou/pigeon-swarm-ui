import type { NodeRegistrationCodeRepository } from '../../../domain/repositories/NodeRegistrationCodeRepository';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { NodeRegistrationCodeExpiry } from '../../../domain/value-objects/NodeRegistrationCodeExpiry';
import type { NodeRegistrationCodeId } from '../../../domain/value-objects/NodeRegistrationCodeId';
import type { NodeRegistrationCodeUses } from '../../../domain/value-objects/NodeRegistrationCodeUses';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { IssuedNodeRegistrationCode } from '../../../domain/IssuedNodeRegistrationCode';
import { NodeRegistrationCode } from '../../../domain/NodeRegistrationCode';

// eslint-disable-next-line max-len
export class PigeonNodeRegistrationCodeRepository implements NodeRegistrationCodeRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
  ) {}

  public async issue(
    maxUses: NodeRegistrationCodeUses,
    expiresAt: NodeRegistrationCodeExpiry,
    actorId: NodeAccessActorId,
  ): Promise<IssuedNodeRegistrationCode> {
    return IssuedNodeRegistrationCode.fromPrimitives(
      await this.api.createRegistrationCode(
        { expiresAt: expiresAt.valueOf(), maxUses: maxUses.valueOf() },
        this.sessions.find(actorId),
      ),
    );
  }

  public async revoke(
    id: NodeRegistrationCodeId,
    actorId: NodeAccessActorId,
  ): Promise<void> {
    await this.api.deleteRegistrationCode(
      id.valueOf(),
      this.sessions.find(actorId),
    );
  }

  public async search(
    actorId: NodeAccessActorId,
  ): Promise<NodeRegistrationCode[]> {
    const codes = await this.api.getRegistrationCodes(
      this.sessions.find(actorId),
    );

    return codes.map((code) => NodeRegistrationCode.fromPrimitives(code));
  }
}
