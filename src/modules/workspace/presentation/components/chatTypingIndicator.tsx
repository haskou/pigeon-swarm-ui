import {
  identityDisplayName,
  type IdentityNames,
} from '../../../identities/presentation/view-models/identityDisplay';
import { TypingIndicator } from '../../../messages/presentation/components/typingIndicator';

interface ChatTypingIndicatorProps {
  identityIds: string[];
  identityNames: IdentityNames;
}

export function ChatTypingIndicator({
  identityIds,
  identityNames,
}: ChatTypingIndicatorProps) {
  return (
    <TypingIndicator
      getIdentityName={(identityId) =>
        identityDisplayName(identityId, identityNames)
      }
      identityIds={identityIds}
    />
  );
}
