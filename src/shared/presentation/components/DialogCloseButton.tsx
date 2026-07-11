import type { ReactElement } from 'react';

import { cx } from '../cx';
import { copy } from '../i18n/copy';

export function DialogCloseButton({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('ui-icon-button', className)}
      aria-label={copy.dialog.close}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
