import type { CommunityResource as Community } from '../../../communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../identities/presentation/view-models/identityDisplay';

export type NotificationPreview = {
  avatarUrl?: string;
  loading?: boolean;
  subtitle?: string;
  title: string;
};

export interface NotificationPreviewContext {
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
}
