import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityCreationMaterial } from './IdentityCreationMaterial';

import { IdentityCreationMaterialNotFoundError } from './IdentityCreationMaterialNotFoundError';

export class IdentityCreationMaterials {
  private readonly materials = new Map<string, IdentityCreationMaterial>();

  public consume(identityId: IdentityId): IdentityCreationMaterial {
    const key = identityId.toString();
    const material = this.materials.get(key);

    if (!material) throw new IdentityCreationMaterialNotFoundError();

    this.materials.delete(key);

    return material;
  }

  public register(
    identityId: IdentityId,
    material: IdentityCreationMaterial,
  ): void {
    this.materials.set(identityId.toString(), material);
  }
}
