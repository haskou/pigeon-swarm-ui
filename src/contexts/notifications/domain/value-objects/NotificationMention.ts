import { NotificationRecipientId } from './NotificationRecipientId';
import { NotificationRoleId } from './NotificationRoleId';

export class NotificationMention {
  public static fromPrimitives(primitives: {
    currentIdentityId: string;
    currentRoleIds?: string[];
    mentionedIdentityIds?: string[];
    mentionedRoleIds?: string[];
    mentionedRoleMemberIds?: string[];
    mentionsEveryoneOrHere?: boolean;
  }): NotificationMention {
    return new NotificationMention(
      NotificationRecipientId.fromString(primitives.currentIdentityId),
      (primitives.currentRoleIds ?? []).map(NotificationRoleId.fromString),
      (primitives.mentionedIdentityIds ?? []).map(
        NotificationRecipientId.fromString,
      ),
      (primitives.mentionedRoleIds ?? []).map(NotificationRoleId.fromString),
      (primitives.mentionedRoleMemberIds ?? []).map(
        NotificationRecipientId.fromString,
      ),
      primitives.mentionsEveryoneOrHere ?? false,
    );
  }

  private constructor(
    private readonly currentIdentityId: NotificationRecipientId,
    private readonly currentRoleIds: NotificationRoleId[],
    private readonly mentionedIdentityIds: NotificationRecipientId[],
    private readonly mentionedRoleIds: NotificationRoleId[],
    private readonly mentionedRoleMemberIds: NotificationRecipientId[],
    private readonly everyoneOrHere: boolean,
  ) {}

  public directlyMentionsCurrentIdentity(): boolean {
    return this.mentionedIdentityIds.some((identityId) =>
      identityId.isEqual(this.currentIdentityId),
    );
  }

  public mentionsCurrentIdentityThroughRole(): boolean {
    return (
      this.mentionedRoleMemberIds.some((identityId) =>
        identityId.isEqual(this.currentIdentityId),
      ) ||
      this.currentRoleIds.some((currentRoleId) =>
        this.mentionedRoleIds.some((mentionedRoleId) =>
          mentionedRoleId.isEqual(currentRoleId),
        ),
      )
    );
  }

  public mentionsEveryoneOrHere(): boolean {
    return this.everyoneOrHere;
  }
}
