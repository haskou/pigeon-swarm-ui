import type { MouseEvent } from 'react';

import type { IdentityMemberListItem } from './IdentityMemberListPanel';

import { cx } from '../../../../shared/presentation/cx';
import { IdentityMemberListPanel } from './IdentityMemberListPanel';

export type IdentityMembersAsideVariant = 'desktop' | 'mobile';

export function IdentityMembersAside({
  action,
  animateEntries = true,
  animationScopeKey,
  className,
  emptyLabel,
  items,
  onItemClick,
  ownerLabel,
  transitionState = 'open',
  variant,
}: {
  action?: {
    label: string;
    onClick: () => void;
  };
  animateEntries?: boolean;
  animationScopeKey?: string;
  className?: string;
  emptyLabel: string;
  items: IdentityMemberListItem[];
  onItemClick: (
    item: IdentityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  ownerLabel?: string;
  transitionState?: 'closing' | 'open';
  variant: IdentityMembersAsideVariant;
}) {
  return (
    <aside
      className={cx(identityMembersAsideClassName(variant), className)}
      data-state={transitionState}
    >
      <IdentityMemberListPanel
        action={action}
        animateEntries={animateEntries}
        animationScopeKey={animationScopeKey}
        emptyLabel={emptyLabel}
        items={items}
        onItemClick={onItemClick}
        ownerLabel={ownerLabel}
      />
    </aside>
  );
}

function identityMembersAsideClassName(
  variant: IdentityMembersAsideVariant,
): string {
  if (variant === 'desktop') {
    return 'glass-panel community-members-panel hidden h-full min-h-0 overflow-y-auto rounded-none p-4 xl:block';
  }

  return 'app-safe-area-drawer-until-xl app-safe-area-drawer-py-4 app-drawer-right glass-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] overflow-y-auto rounded-none p-4 xl:hidden';
}
