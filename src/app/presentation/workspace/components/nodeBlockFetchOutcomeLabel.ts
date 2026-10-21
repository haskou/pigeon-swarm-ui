import { copy } from '../../../../shared/presentation/i18n/copy';

const fetchOutcomes: Record<string, string> = copy.nodeAccess.fetchOutcomes;

/**
 * The text shown for the outcome of a followed block list's last fetch, or
 * null when the outcome is unknown to this client.
 */
export function nodeBlockFetchOutcomeLabel(
  outcome: null | string,
): null | string {
  if (outcome === null) return null;

  return Object.prototype.hasOwnProperty.call(fetchOutcomes, outcome)
    ? fetchOutcomes[outcome]
    : null;
}
