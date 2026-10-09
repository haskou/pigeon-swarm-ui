import type {
  Community,
  CommunityTextChannel,
  CommunityVoiceChannel,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PigeonMlsFacade } from '../../mls/PigeonMlsFacade';
import type { CommunityImageCids } from './CommunityImageCids';
import type { CreateCommunityInput } from './CreateCommunityInput';

import { PigeonCommunitiesGateway } from '../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';

export class CreateCommunity {
  public constructor(
    private readonly communities: PigeonCommunitiesGateway,
    private readonly mls: PigeonMlsFacade,
  ) {}

  private async uploadImages(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<CommunityImageCids> {
    const avatarCid = input.avatar
      ? (await this.communities.uploadPublicFile(session, input.avatar)).cid
      : undefined;
    const bannerCid = input.banner
      ? (await this.communities.uploadPublicFile(session, input.banner)).cid
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
    return await this.communities.createCommunity(session, {
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
          await this.communities.createCommunityVoiceChannel(
            session,
            communityId,
            input.name,
          ),
        );
        continue;
      }

      textChannels.push(
        await this.communities.createCommunityTextChannel(
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

  /** Creates the community and, if private, its encrypted group. */
  public async create(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<Community> {
    const images = await this.uploadImages(session, input);
    const community = await this.createResource(session, input, images);

    if ((community.visibility ?? input.visibility ?? 'private') !== 'public') {
      await this.mls.createGroup(session, community.id);
    }

    return this.withInitialChannels(
      community,
      await this.createInitialChannels(session, community.id, input.channels),
    );
  }
}
