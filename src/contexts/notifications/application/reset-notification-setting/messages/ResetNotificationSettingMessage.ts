import { Timestamp } from '@haskou/value-objects';

import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';
import { NotificationSettingScope } from '../../../domain/value-objects/NotificationSettingScope';
import { NotificationSettingScopeIdentifier } from '../../../domain/value-objects/NotificationSettingScopeIdentifier';
import { NotificationSettingScopeType } from '../../../domain/value-objects/NotificationSettingScopeType';

export class ResetNotificationSettingMessage {
  public constructor(
    private readonly recipientIdentityId: string,
    private readonly scopeType: string,
    private readonly firstScopeIdentifier: string,
    private readonly secondScopeIdentifier: string | undefined,
    private readonly occurredAt: number,
  ) {}

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(this.recipientIdentityId);
  }

  public getScope(): NotificationSettingScope {
    const type = NotificationSettingScopeType.fromPrimitives(this.scopeType);
    const first = NotificationSettingScopeIdentifier.fromString(
      this.firstScopeIdentifier,
    );

    if (type.isCommunityChannel()) {
      return NotificationSettingScope.communityChannel(
        first,
        NotificationSettingScopeIdentifier.fromString(
          this.secondScopeIdentifier ?? '',
        ),
      );
    }

    return type.isCommunity()
      ? NotificationSettingScope.community(first)
      : NotificationSettingScope.conversation(first);
  }
}
