import type { ReactElement, ReactNode } from 'react';

import { copy } from '../i18n/copy';

export function DialogHeader({
  description,
  kicker,
  onClose,
  title,
}: {
  description?: ReactNode;
  kicker?: ReactNode;
  onClose: () => void;
  title: ReactNode;
}): ReactElement {
  return (
    <header className="ui-dialog-header">
      <div className="min-w-0">
        {kicker ? <div className="ui-kicker">{kicker}</div> : null}
        <h2 className="ui-dialog-title">{title}</h2>
        {description ? (
          <div className="ui-dialog-description">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ui-icon-button shrink-0"
        aria-label={copy.dialog.close}
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>
  );
}
