import {
  identityDisplayName,
  type IdentityNames,
} from '../../../../modules/identities/presentation/view-models/identityDisplay';
import { TypingIndicator } from '../../../../modules/messages/presentation/components/TypingIndicator';

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
