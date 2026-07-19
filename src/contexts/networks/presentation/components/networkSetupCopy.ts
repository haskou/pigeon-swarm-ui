import type { NetworkSetupMode } from './NetworkSetupMode';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function networkSetupBody(mode: NetworkSetupMode): string {
  if (mode === 'create') return copy.network.createBody;

  if (mode === 'join') return copy.network.joinBody;

  return copy.network.publicBody;
}

export function networkSetupSubmitLabel(
  mode: NetworkSetupMode,
  loading: boolean,
): string {
  if (loading) return copy.network.loadingSubmit;

  if (mode === 'create') return copy.network.createSubmit;

  if (mode === 'join') return copy.network.joinSubmit;

  return copy.network.publicSubmit;
}
