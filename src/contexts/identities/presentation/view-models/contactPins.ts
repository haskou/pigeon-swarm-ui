import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';
import type { ContactKeyCheck } from '../../domain/ContactPins';

import { checkContactKey } from '../../domain/ContactPins';
import { ContactPinStore } from '../../infrastructure/storage/ContactPinStore';

export const contactPinStore = new ContactPinStore();

export function checkIdentityContact(
  localIdentityId: string,
  identity: IdentityResource,
): ContactKeyCheck {
  return checkContactKey(
    contactPinStore.load(localIdentityId),
    identity.id,
    identity.profile.handle ?? undefined,
  );
}

export function rememberIdentityContact(
  localIdentityId: string,
  identity: IdentityResource,
): void {
  contactPinStore.remember(
    localIdentityId,
    identity.id,
    identity.profile.handle ?? undefined,
  );
}
