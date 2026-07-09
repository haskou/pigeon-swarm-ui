import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { JsonDataViewer } from '../../../../shared/presentation/components/JsonDataViewer';
import { collectIpfsLinks } from '../../../../shared/presentation/ipfsLinks';
import { IpfsLinksPanel } from './IpfsLinksPanel';

export function ConversationDataDialog({
  data,
  onClose,
  title = copy.chat.conversationDataTitle,
}: {
  data: unknown;
  onClose: () => void;
  title?: string;
}) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);
  const ipfsLinks = collectIpfsLinks(data);

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-[84vh] sm:max-w-4xl"
        data-state={state}
      >
        <DialogHeader title={title} onClose={close} />
        <div className="min-h-0 overflow-auto px-5 py-4">
          <IpfsLinksPanel links={ipfsLinks} />
          <JsonDataViewer data={data} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
