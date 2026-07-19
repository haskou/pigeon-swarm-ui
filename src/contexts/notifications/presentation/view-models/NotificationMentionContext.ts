export type NotificationMentionContext = {
  currentIdentityId: string;
  currentRoleIds?: string[];
  mentionedIdentityIds?: string[];
  mentionedRoleIds?: string[];
  mentionedRoleMemberIds?: string[];
  mentionsEveryoneOrHere?: boolean;
};
