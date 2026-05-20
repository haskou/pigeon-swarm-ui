import type {
  Community,
  ConversationResource,
  IdentityResource,
} from '../../../../domain/types';

import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../utils/identityDisplay';

export type NotificationPreview = {
  avatarUrl?: string;
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
