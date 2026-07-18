import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NotificationDeliveryPreferences } from './value-objects/NotificationDeliveryPreferences';
import { NotificationLevel } from './value-objects/NotificationLevel';
import { NotificationMention } from './value-objects/NotificationMention';
import { NotificationMute } from './value-objects/NotificationMute';
import { NotificationSettingEventType } from './value-objects/NotificationSettingEventType';
import { NotificationSettingScope } from './value-objects/NotificationSettingScope';

export class NotificationSetting extends AggregateRoot {
  public static configure(
    scope: NotificationSettingScope,
    level: NotificationLevel,
    mute: NotificationMute,
    preferences: NotificationDeliveryPreferences,
    occurredAt: Timestamp,
  ): NotificationSetting {
    const setting = new NotificationSetting(
      scope,
      level,
      mute,
      preferences,
      occurredAt,
    );

    setting.recordChange(NotificationSettingEventType.SAVED, occurredAt);

    return setting;
  }

  public static defaults(scope: NotificationSettingScope): NotificationSetting {
    return new NotificationSetting(
      scope,
      NotificationLevel.ALL,
      NotificationMute.fromPrimitives(),
      NotificationDeliveryPreferences.defaults(),
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<NotificationSetting>,
  ): NotificationSetting {
    return new NotificationSetting(
      NotificationSettingScope.fromPrimitives(primitives.scope),
      NotificationLevel.fromPrimitives(primitives.notificationLevel),
      NotificationMute.fromPrimitives(primitives.mutedUntil),
      NotificationDeliveryPreferences.fromPrimitives({
        hideMutedChannels: primitives.hideMutedChannels,
        mobilePushEnabled: primitives.mobilePushEnabled,
        suppressEveryoneAndHere: primitives.suppressEveryoneAndHere,
        suppressRoleMentions: primitives.suppressRoleMentions,
      }),
      primitives.updatedAt === undefined
        ? undefined
        : new Timestamp(primitives.updatedAt),
    );
  }

  private constructor(
    private readonly scope: NotificationSettingScope,
    private readonly level: NotificationLevel,
    private readonly mute: NotificationMute,
    private readonly preferences: NotificationDeliveryPreferences,
    private readonly updatedAt?: Timestamp,
  ) {
    super();
  }

  private recordChange(
    type: NotificationSettingEventType,
    occurredAt: Timestamp,
  ): void {
    this.record({
      aggregateId: this.scope.key(),
      occurredAt: occurredAt.valueOf(),
      type: type.valueOf(),
    });
  }

  public belongsTo(scope: NotificationSettingScope): boolean {
    return this.scope.belongsTo(scope);
  }

  public isMuted(now: Timestamp): boolean {
    return this.level.silencesAll() || this.mute.isActive(now);
  }

  public reset(occurredAt: Timestamp): void {
    this.recordChange(NotificationSettingEventType.RESET, occurredAt);
  }

  public shouldHide(now: Timestamp): boolean {
    return this.preferences.hidesMutedChannels() && this.isMuted(now);
  }

  public shouldNotify(mention: NotificationMention, now: Timestamp): boolean {
    if (this.isMuted(now)) return false;

    if (this.level.includesAll()) return true;

    if (!this.level.includesMentions()) return false;

    return this.preferences.allowsMention(mention);
  }

  public toPrimitives() {
    return {
      ...this.preferences.toPrimitives(),
      mutedUntil: this.mute.toPrimitives(),
      notificationLevel: this.level.valueOf(),
      scope: this.scope.toPrimitives(),
      updatedAt: this.updatedAt?.valueOf(),
    };
  }
}
