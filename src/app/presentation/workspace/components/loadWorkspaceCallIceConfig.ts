import type { CallIceServerResource } from '../../../../contexts/calls/infrastructure/http/resources/CallIceServerResource';

import { logCallError } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { copy } from '../../../../shared/presentation/i18n/copy';

export async function loadWorkspaceCallIceConfig(
  load: () => Promise<CallIceServerResource>,
): Promise<CallIceServerResource> {
  try {
    return await load();
  } catch {
    const error = new Error(copy.calls.iceServersUnavailable);
    logCallError('workspace:call:ice-config-unavailable', error);

    throw error;
  }
}
