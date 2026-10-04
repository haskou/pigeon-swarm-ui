import { copy } from '../../../../shared/presentation/i18n/copy';

export function CommunityNoChannelSelected() {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-3xl font-black">
          #
        </div>
        <h2 className="mt-5 text-2xl font-black">
          {copy.communities.noChannelSelected}
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/55">
          {copy.communities.noChannelSelectedBody}
        </p>
      </div>
    </div>
  );
}
