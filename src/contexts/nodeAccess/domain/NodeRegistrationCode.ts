import { NodeRegistrationCodeExpiry } from './value-objects/NodeRegistrationCodeExpiry';
import { NodeRegistrationCodeId } from './value-objects/NodeRegistrationCodeId';
import { NodeRegistrationCodeUses } from './value-objects/NodeRegistrationCodeUses';

export interface NodeRegistrationCodePrimitives {
  expiresAt: number;
  id: string;
  maxUses: number;
  usesLeft: number;
}

/** A registration code as the node lists it: never the code itself. */
export class NodeRegistrationCode {
  public static fromPrimitives(
    primitives: NodeRegistrationCodePrimitives,
  ): NodeRegistrationCode {
    return new NodeRegistrationCode(
      NodeRegistrationCodeId.fromString(primitives.id),
      NodeRegistrationCodeUses.fromNumber(primitives.maxUses),
      NodeRegistrationCodeUses.fromNumber(primitives.usesLeft),
      NodeRegistrationCodeExpiry.fromMilliseconds(primitives.expiresAt),
    );
  }

  private constructor(
    private readonly id: NodeRegistrationCodeId,
    private readonly maxUses: NodeRegistrationCodeUses,
    private readonly usesLeft: NodeRegistrationCodeUses,
    private readonly expiresAt: NodeRegistrationCodeExpiry,
  ) {}

  public toPrimitives(): NodeRegistrationCodePrimitives {
    return {
      expiresAt: this.expiresAt.valueOf(),
      id: this.id.valueOf(),
      maxUses: this.maxUses.valueOf(),
      usesLeft: this.usesLeft.valueOf(),
    };
  }
}
