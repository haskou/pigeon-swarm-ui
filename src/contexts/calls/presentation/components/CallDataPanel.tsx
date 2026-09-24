import { useEffect, useState } from 'react';
import type { CallSession } from '../view-models/CallSession';

import { JsonDataViewer } from '../../../../shared/presentation/components/JsonDataViewer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  readCallDiagnostics,
  startCallDiagnostics,
  stopCallDiagnostics,
} from '../../infrastructure/media/callDebugLogger';
import { callDiagnosticReport } from './callDiagnosticReport';

export function CallDataPanel({ call }: { call: CallSession }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const timer = setInterval(
      () => setActive(readCallDiagnostics().active),
      1000,
    );
    return () => {
      clearInterval(timer);
      stopCallDiagnostics();
    };
  }, []);
  const data = active ? callDiagnosticReport(call) : undefined;

  function toggleCapture(): void {
    if (active) stopCallDiagnostics();
    else startCallDiagnostics();
    setActive(readCallDiagnostics().active);
  }

  function download(): void {
    if (!readCallDiagnostics().active) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(callDiagnosticReport(call), null, 2)], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'call-diagnostics.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-t border-white/10 pt-4">
      <h3 className="mb-3 text-sm font-black text-white/80">
        {copy.calls.callData}
      </h3>
      <p className="mb-3 text-xs text-white/60">
        {copy.calls.diagnosticsPrivacy}
      </p>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white"
          onClick={toggleCapture}
        >
          {active ? copy.calls.stopDiagnostics : copy.calls.startDiagnostics}
        </button>
        {active && (
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white"
            onClick={download}
          >
            {copy.calls.exportDiagnostics}
          </button>
        )}
      </div>
      {data && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <JsonDataViewer data={data} />
        </div>
      )}
    </aside>
  );
}
