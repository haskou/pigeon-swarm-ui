import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { ProfilePopoverAnchor } from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';

export interface ChatProfileViewer {
  anchor?: ProfilePopoverAnchor;
  identity?: IdentityResource;
  identityId: string;
  name: string;
  picture?: string | null;
}
