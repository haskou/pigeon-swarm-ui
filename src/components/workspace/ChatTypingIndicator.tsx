import {
  identityDisplayName,
  type IdentityNames,
} from '../../utils/identityDisplay';
import { TypingIndicator } from '../chat/TypingIndicator';

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
