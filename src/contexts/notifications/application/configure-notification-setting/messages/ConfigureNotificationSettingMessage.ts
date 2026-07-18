import { Timestamp } from '@haskou/value-objects';

import { NotificationDeliveryPreferences } from '../../../domain/value-objects/NotificationDeliveryPreferences';
import { NotificationLevel } from '../../../domain/value-objects/NotificationLevel';
import { NotificationMute } from '../../../domain/value-objects/NotificationMute';
import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';
import { NotificationSettingScope } from '../../../domain/value-objects/NotificationSettingScope';
import { NotificationSettingScopeIdentifier } from '../../../domain/value-objects/NotificationSettingScopeIdentifier';
import { NotificationSettingScopeType } from '../../../domain/value-objects/NotificationSettingScopeType';

export class ConfigureNotificationSettingMessage {
  public constructor(
    private readonly primitives: {
      firstScopeIdentifier: string;
      hideMutedChannels: boolean;
      mobilePushEnabled: boolean;
      mutedUntil: number | null | undefined;
      notificationLevel: string;
      occurredAt: number;
      recipientIdentityId: string;
      scopeType: string;
      secondScopeIdentifier: string | undefined;
      suppressEveryoneAndHere: boolean;
      suppressRoleMentions: boolean;
    },
  ) {}

  public getLevel(): NotificationLevel {
    return NotificationLevel.fromPrimitives(this.primitives.notificationLevel);
  }

  public getMute(): NotificationMute {
    return NotificationMute.fromPrimitives(this.primitives.mutedUntil);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.primitives.occurredAt);
  }

  public getPreferences(): NotificationDeliveryPreferences {
    return NotificationDeliveryPreferences.fromPrimitives({
      hideMutedChannels: this.primitives.hideMutedChannels,
      mobilePushEnabled: this.primitives.mobilePushEnabled,
      suppressEveryoneAndHere: this.primitives.suppressEveryoneAndHere,
      suppressRoleMentions: this.primitives.suppressRoleMentions,
    });
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(
      this.primitives.recipientIdentityId,
    );
  }

  public getScope(): NotificationSettingScope {
    const type = NotificationSettingScopeType.fromPrimitives(
      this.primitives.scopeType,
    );
    const first = NotificationSettingScopeIdentifier.fromString(
      this.primitives.firstScopeIdentifier,
    );

    if (type.isCommunityChannel()) {
      return NotificationSettingScope.communityChannel(
        first,
        NotificationSettingScopeIdentifier.fromString(
          this.primitives.secondScopeIdentifier ?? '',
        ),
      );
    }

    return type.isCommunity()
      ? NotificationSettingScope.community(first)
      : NotificationSettingScope.conversation(first);
  }
}
