import { SymmetricKey } from '@haskou/value-objects';

import type {
  Community,
  CommunityTextChannel,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ManageCommunityChannelsPort } from '../manage-community-channels/ManageCommunityChannelsPort';
import type { CommunityKeychainPort } from '../publish-community-keychain/CommunityKeychainPort';
import type { CommunityMediaPort } from '../upload-community-media/CommunityMediaPort';
import type { CommunityImageCids } from './CommunityImageCids';
import type { CreateCommunityInput } from './CreateCommunityInput';
import type { CreateCommunityPort } from './CreateCommunityPort';
import type { CreateCommunityResult } from './CreateCommunityResult';
import type { CreateCommunityMessage } from './messages/CreateCommunityMessage';

export class CreateCommunity {
  public constructor(
    private readonly communityCreator: CreateCommunityPort,
    private readonly channels: ManageCommunityChannelsPort,
    private readonly keychain: CommunityKeychainPort,
    private readonly media: CommunityMediaPort,
  ) {}

  private async uploadImages(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<CommunityImageCids> {
    const avatarCid = input.avatar
      ? (await this.media.uploadPublicFile(session, input.avatar)).cid
      : undefined;
    const bannerCid = input.banner
      ? (await this.media.uploadPublicFile(session, input.banner)).cid
      : undefined;

    return {
      ...(avatarCid ? { avatarCid } : {}),
      ...(bannerCid ? { bannerCid } : {}),
    };
  }

  private async createResource(
    session: Session,
    input: CreateCommunityInput,
    images: CommunityImageCids,
  ): Promise<Community> {
    return await this.communityCreator.createCommunity(session, {
      autoJoinEnabled: input.autoJoinEnabled,
      ...(images.avatarCid ? { avatar: images.avatarCid } : {}),
      ...(images.bannerCid ? { banner: images.bannerCid } : {}),
      description: input.description,
      discoverable: input.discoverable,
      name: input.name,
      networkId: input.networkId,
      visibility: input.visibility,
    });
  }

  private async createInitialChannels(
    session: Session,
    communityId: string,
    inputs: CreateCommunityInput['channels'],
  ): Promise<{
    textChannels: CommunityTextChannel[];
    voiceChannels: CommunityVoiceChannel[];
  }> {
    const textChannels: CommunityTextChannel[] = [];
    const voiceChannels: CommunityVoiceChannel[] = [];

    for (const input of inputs ?? []) {
      if (input.type === 'voice') {
        voiceChannels.push(
          await this.channels.createCommunityVoiceChannel(
            session,
            communityId,
            input.name,
          ),
        );
        continue;
      }

      textChannels.push(
        await this.channels.createCommunityTextChannel(
          session,
          communityId,
          input.name,
        ),
      );
    }

    return { textChannels, voiceChannels };
  }

  private withInitialChannels(
    community: Community,
    initialChannels: {
      textChannels: CommunityTextChannel[];
      voiceChannels: CommunityVoiceChannel[];
    },
  ): Community {
    return {
      ...community,
      textChannels: [
        ...community.textChannels,
        ...initialChannels.textChannels,
      ],
      voiceChannels:
        initialChannels.voiceChannels.length > 0
          ? [
              ...(community.voiceChannels ?? []),
              ...initialChannels.voiceChannels,
            ]
          : community.voiceChannels,
    };
  }

  private createCommunityKeyEntry(communityId: string): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId: communityId,
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    };
  }

  public async create(
    message: CreateCommunityMessage,
  ): Promise<CreateCommunityResult> {
    const session = message.getSession();
    const input = message.getInput();
    const images = await this.uploadImages(session, input);
    const community = await this.createResource(session, input, images);

    if ((community.visibility ?? input.visibility ?? 'private') === 'public') {
      const initialChannels = await this.createInitialChannels(
        session,
        community.id,
        input.channels,
      );

      return {
        community: this.withInitialChannels(community, initialChannels),
        keychain: session.keychain,
        keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      };
    }

    const keyEntry = this.createCommunityKeyEntry(community.id);
    const published = await this.keychain.publishKeychain(session, {
      ...session.keychain,
      conversations: {
        ...session.keychain.conversations,
        [community.id]: keyEntry,
      },
    });
    const privateInitialChannels = await this.createInitialChannels(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      community.id,
      input.channels,
    );

    return {
      community: this.withInitialChannels(community, privateInitialChannels),
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }
}
