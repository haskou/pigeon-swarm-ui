import type { ProfilePopoverAnchor } from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';
import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export interface ChatProfileViewer {
  anchor?: ProfilePopoverAnchor;
  identity?: IdentityResource;
  identityId: string;
  name: string;
  picture?: string | null;
}
