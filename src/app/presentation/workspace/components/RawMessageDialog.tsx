import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { collectIpfsLinks } from '../../../../shared/presentation/ipfsLinks';
import { IpfsLinksPanel } from './IpfsLinksPanel';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { JsonDataViewer } from '../../../../shared/presentation/components/JsonDataViewer';

export function RawMessageDialog({
  message,
  onClose,
}: {
  message: ChatMessage;
  onClose: () => void;
}) {
  const { close, state } = useCloseTransition(onClose);
  const ipfsLinks = collectIpfsLinks({
    attachments: message.attachments,
    raw: message.raw,
  });
  const decrypted = {
    attachments: message.attachments,
    content: message.content,
    mentions: message.mentions,
    originalContent: message.originalContent,
    poll: message.poll,
    sticker: message.sticker,
  };
  const derived = {
    attachmentProgress: message.attachmentProgress,
    authorIdentityId: message.authorIdentityId,
    deliveryStatus: message.deliveryStatus,
    edited: message.edited,
    editedAt: message.editedAt,
    encrypted: message.encrypted,
    id: message.id,
    kind: message.kind,
    mine: message.mine,
    reactions: message.reactions,
    replyPreview: message.replyPreview,
    replyToMessageId: message.replyToMessageId,
    threadRootMessageId: message.threadRootMessageId,
    timestamp: message.timestamp,
  };

  useCloseOnEscape(close);

  return (
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
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-3xl"
        data-state={state}
      >
        <DialogHeader title={copy.messages.rawTitle} onClose={close} />
        <div className="min-h-0 overflow-auto px-5 py-4">
          <IpfsLinksPanel links={ipfsLinks} />
          <JsonDataViewer
            data={message}
            sections={[
              { label: copy.dataViewer.received, value: message.raw },
              { label: copy.dataViewer.decrypted, value: decrypted },
              { label: copy.dataViewer.derived, value: derived },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
