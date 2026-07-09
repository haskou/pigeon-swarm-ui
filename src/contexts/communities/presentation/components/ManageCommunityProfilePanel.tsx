import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { Community } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityPublicSettingsPanel } from './CommunityPublicSettingsPanel';

type ManageCommunityProfileImageEditor = {
  file: File;
  shape: 'avatar' | 'banner';
};

type ManageCommunityProfilePanelProps = {
  autoJoinEnabled: boolean;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  avatarPreview: null | string;
  bannerInputRef: RefObject<HTMLInputElement | null>;
  bannerPreview: null | string;
  community: Community;
  currentAvatarUrl: null | string;
  currentBannerUrl: null | string;
  description: string;
  disabled: boolean;
  discoverable: boolean;
  name: string;
  onAutoJoinChange: (enabled: boolean) => void;
  onDescriptionChange: (description: string) => void;
  onDiscoverableChange: (discoverable: boolean) => void;
  onNameChange: (name: string) => void;
  onImageEditorChange: Dispatch<
    SetStateAction<ManageCommunityProfileImageEditor | null>
  >;
};

export function ManageCommunityProfilePanel({
  autoJoinEnabled,
  avatarInputRef,
  avatarPreview,
  bannerInputRef,
  bannerPreview,
  community,
  currentAvatarUrl,
  currentBannerUrl,
  description,
  disabled,
  discoverable,
  name,
  onAutoJoinChange,
  onDescriptionChange,
  onDiscoverableChange,
  onImageEditorChange,
  onNameChange,
}: ManageCommunityProfilePanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/10">
      <button
        type="button"
        onClick={() => bannerInputRef.current?.click()}
        className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
        aria-label={copy.communities.banner}
      >
        {bannerPreview || currentBannerUrl ? (
          <img
            src={bannerPreview ?? currentBannerUrl ?? ''}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-4xl font-black text-white/80">
            {community.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
          ✎
        </span>
      </button>
      <div className="relative px-4 pb-4">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-lg border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
          aria-label={copy.communities.avatar}
        >
          {avatarPreview || currentAvatarUrl ? (
            <img
              src={avatarPreview ?? currentAvatarUrl ?? ''}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            community.name.slice(0, 1).toUpperCase()
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
            ✎
          </span>
        </button>
        <div className="mt-4 grid gap-3">
          <input
            aria-label={copy.communities.name}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="ui-field-control px-4 py-3 text-lg font-black placeholder:text-white/30"
          />
          <textarea
            aria-label={copy.communities.description}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="ui-field-control min-h-20 resize-none px-4 py-3 text-sm placeholder:text-white/30"
          />
          <CommunityPublicSettingsPanel
            autoJoinEnabled={autoJoinEnabled}
            discoverable={discoverable}
            disabled={disabled}
            framed={false}
            onAutoJoinChange={onAutoJoinChange}
            onDiscoverableChange={onDiscoverableChange}
            visibility={community.visibility}
          />
        </div>
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) onImageEditorChange({ file, shape: 'avatar' });
          event.target.value = '';
        }}
        className="sr-only"
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) onImageEditorChange({ file, shape: 'banner' });
          event.target.value = '';
        }}
        className="sr-only"
      />
    </div>
  );
}
