import { NodeRegistrationCode } from './NodeRegistrationCode';
import { NodeRegistrationCodeSecret } from './value-objects/NodeRegistrationCodeSecret';

/** A freshly issued code: the only time the node hands out the secret. */
export class IssuedNodeRegistrationCode {
  public static fromPrimitives(primitives: {
    code: string;
    expiresAt: number;
    id: string;
    maxUses: number;
  }): IssuedNodeRegistrationCode {
    return new IssuedNodeRegistrationCode(
      NodeRegistrationCode.fromPrimitives({
        expiresAt: primitives.expiresAt,
        id: primitives.id,
        maxUses: primitives.maxUses,
        usesLeft: primitives.maxUses,
      }),
      NodeRegistrationCodeSecret.fromString(primitives.code),
    );
  }

  private constructor(
    private readonly code: NodeRegistrationCode,
    private readonly secret: NodeRegistrationCodeSecret,
  ) {}

  public getCode(): NodeRegistrationCode {
    return this.code;
  }

  public getSecret(): NodeRegistrationCodeSecret {
    return this.secret;
  }
}
