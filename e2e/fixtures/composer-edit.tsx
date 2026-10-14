import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { Composer } from '../../src/contexts/messages/presentation/components/Composer';
import type { ChatMessage } from '../../src/contexts/messages/domain/ChatMessage';
import type { Session } from '../../src/contexts/identities/infrastructure/session/Session';
import type { MessageResource } from '../../src/contexts/messages/infrastructure/http/MessageResource';

const message: ChatMessage = {
  attachments: [],
  authorIdentityId: 'alice',
  content: 'original text',
  encrypted: true,
  id: 'message-id',
  mine: true,
  raw: {} as MessageResource,
  reactions: [],
  timestamp: Date.now(),
};

function ComposerEditFixture() {
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Same single update as the workspaces' startEditing.
          setEditingMessage(message);
          setDraft(message.content);
        }}
      >
        Edit message
      </button>
      <Composer
        attachmentEncryptionAvailable={false}
        disabled={false}
        draft={draft}
        editingMessage={editingMessage}
        error={null}
        focusKey={`fixture:${editingMessage?.id ?? 'send'}`}
        onDraftChange={setDraft}
        onEdit={async () => undefined}
        onSend={async () => undefined}
        session={{} as Session}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<ComposerEditFixture />);
