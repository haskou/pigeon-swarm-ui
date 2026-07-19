import type { PrimitiveOf } from '@haskou/value-objects';

import type { NotificationMention } from './NotificationMention';

export class NotificationDeliveryPreferences {
  public static defaults(): NotificationDeliveryPreferences {
    return new NotificationDeliveryPreferences(false, false, true, false);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<NotificationDeliveryPreferences>,
  ): NotificationDeliveryPreferences {
    return new NotificationDeliveryPreferences(
      primitives.suppressEveryoneAndHere,
      primitives.suppressRoleMentions,
      primitives.mobilePushEnabled,
      primitives.hideMutedChannels,
    );
  }

  private constructor(
    private readonly suppressEveryoneAndHere: boolean,
    private readonly suppressRoleMentions: boolean,
    private readonly mobilePushEnabled: boolean,
    private readonly hideMutedChannels: boolean,
  ) {}

  public allowsMention(mention: NotificationMention): boolean {
    if (mention.directlyMentionsCurrentIdentity()) return true;

    if (!this.suppressEveryoneAndHere && mention.mentionsEveryoneOrHere()) {
      return true;
    }

    return (
      !this.suppressRoleMentions && mention.mentionsCurrentIdentityThroughRole()
    );
  }

  public hidesMutedChannels(): boolean {
    return this.hideMutedChannels;
  }

  public toPrimitives() {
    return {
      hideMutedChannels: this.hideMutedChannels,
      mobilePushEnabled: this.mobilePushEnabled,
      suppressEveryoneAndHere: this.suppressEveryoneAndHere,
      suppressRoleMentions: this.suppressRoleMentions,
    };
  }
}
