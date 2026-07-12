import type { ReactElement, ReactNode } from 'react';

import { DialogCloseButton } from './DialogCloseButton';

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
      <DialogCloseButton className="shrink-0" onClick={onClose} />
    </header>
  );
}
