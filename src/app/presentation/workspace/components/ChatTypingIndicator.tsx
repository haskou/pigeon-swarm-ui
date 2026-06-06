import {
  identityDisplayName,
  identityPrimaryDisplayName,
  type IdentityNames,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { TypingIndicator } from '../../../../contexts/messages/presentation/components/TypingIndicator';

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
        identityPrimaryDisplayName(
          identityDisplayName(identityId, identityNames),
        )
      }
      identityIds={identityIds}
    />
  );
}
