import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { MessageCollectionDialog } from '../../../messages/presentation/components/MessageCollectionDialog';

type CommunityPinnedMessagesDialogProps = {
  canManageMessages: boolean;
  collection: {
    error: null | string;
    messages: ChatMessage[];
    state: 'loading' | 'ready';
  };
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  onClose: () => void;
  onMessageOpen: (message: ChatMessage) => void;
  onUnpin: (message: ChatMessage) => Promise<void>;
};

export function CommunityPinnedMessagesDialog({
  canManageMessages,
  collection,
  identityNames,
  identityPictures,
  onClose,
  onMessageOpen,
  onUnpin,
}: CommunityPinnedMessagesDialogProps) {
  return (
    <MessageCollectionDialog
      actions={
        canManageMessages
          ? [
              {
                label: copy.messages.unpin,
                onClick: (message) => void onUnpin(message),
                tone: 'danger',
              },
            ]
          : []
      }
      description={copy.messages.pinnedMessagesBody}
      emptyLabel={
        collection.state === 'loading'
          ? copy.app.loading
          : (collection.error ?? copy.messages.emptyPins)
      }
      identityNames={identityNames}
      identityPictures={identityPictures}
      messages={collection.messages}
      onClose={onClose}
      onMessageOpen={onMessageOpen}
      subtitle={collection.error}
      title={copy.messages.pinnedMessages}
    />
  );
}
