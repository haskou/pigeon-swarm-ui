import type { ReactElement } from 'react';

import { cx } from '../cx';
import { copy } from '../i18n/copy';

export function DialogCloseButton({
  ariaLabel = copy.dialog.close,
  className,
  onClick,
  testId,
}: {
  ariaLabel?: string;
  className?: string;
  onClick: () => void;
  testId?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('ui-icon-button', className)}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
