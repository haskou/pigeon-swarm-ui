import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { NotificationScopeIdentifierRequiredError } from '../errors/NotificationScopeIdentifierRequiredError';
import { NotificationSettingScopeIdentifier } from './NotificationSettingScopeIdentifier';
import { NotificationSettingScopeType } from './NotificationSettingScopeType';

export class NotificationSettingScope {
  public static fromPrimitives(
    primitives: PrimitiveOf<NotificationSettingScope>,
  ): NotificationSettingScope {
    if (primitives.type === 'conversation') {
      return NotificationSettingScope.conversation(
        NotificationSettingScopeIdentifier.fromString(
          primitives.conversationId,
        ),
      );
    }

    if (primitives.type === 'community') {
      return NotificationSettingScope.community(
        NotificationSettingScopeIdentifier.fromString(primitives.communityId),
      );
    }

    return NotificationSettingScope.communityChannel(
      NotificationSettingScopeIdentifier.fromString(primitives.communityId),
      NotificationSettingScopeIdentifier.fromString(primitives.channelId),
    );
  }

  public static community(
    communityId: NotificationSettingScopeIdentifier,
  ): NotificationSettingScope {
    return new NotificationSettingScope(
      NotificationSettingScopeType.COMMUNITY,
      communityId,
    );
  }

  public static communityChannel(
    communityId: NotificationSettingScopeIdentifier,
    channelId: NotificationSettingScopeIdentifier,
  ): NotificationSettingScope {
    return new NotificationSettingScope(
      NotificationSettingScopeType.COMMUNITY_CHANNEL,
      communityId,
      channelId,
    );
  }

  public static conversation(
    conversationId: NotificationSettingScopeIdentifier,
  ): NotificationSettingScope {
    return new NotificationSettingScope(
      NotificationSettingScopeType.CONVERSATION,
      conversationId,
    );
  }

  private constructor(
    private readonly type: NotificationSettingScopeType,
    private readonly firstIdentifier: NotificationSettingScopeIdentifier,
    private readonly secondIdentifier?: NotificationSettingScopeIdentifier,
  ) {
    assert(
      !type.isCommunityChannel() || secondIdentifier !== undefined,
      new NotificationScopeIdentifierRequiredError(),
    );
  }

  public belongsTo(scope: NotificationSettingScope): boolean {
    if (!this.type.isEqual(scope.type)) return false;

    if (!this.firstIdentifier.isEqual(scope.firstIdentifier)) return false;

    if (!this.secondIdentifier || !scope.secondIdentifier) {
      return this.secondIdentifier === scope.secondIdentifier;
    }

    return this.secondIdentifier.isEqual(scope.secondIdentifier);
  }

  public communityParent(): NotificationSettingScope | undefined {
    return this.type.isCommunityChannel()
      ? NotificationSettingScope.community(this.firstIdentifier)
      : undefined;
  }

  public key(): string {
    const prefix = this.type.valueOf();

    return this.secondIdentifier
      ? `${prefix}:${this.firstIdentifier.toString()}:${this.secondIdentifier.toString()}`
      : `${prefix}:${this.firstIdentifier.toString()}`;
  }

  public toPrimitives() {
    if (this.type.isCommunityChannel() && this.secondIdentifier) {
      return {
        channelId: this.secondIdentifier.toString(),
        communityId: this.firstIdentifier.toString(),
        type: 'community_channel' as const,
      };
    }

    if (this.type.isCommunity()) {
      return {
        communityId: this.firstIdentifier.toString(),
        type: 'community' as const,
      };
    }

    return {
      conversationId: this.firstIdentifier.toString(),
      type: 'conversation' as const,
    };
  }
}
