import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Cursor Usage Tracker (Debug)');
  }
  return channel;
}

/** Set `CURSOR_USAGE_TRACKER_DEBUG=1` when launching Cursor to append trace lines (no secrets or log line bodies). */
export function isDebugTraceEnabled(): boolean {
  return process.env.CURSOR_USAGE_TRACKER_DEBUG === '1';
}

export function debugTrace(scope: string, fields: Record<string, string | number | boolean | undefined>): void {
  if (!isDebugTraceEnabled()) return;
  const parts = Object.entries(fields).map(([k, v]) => {
    if (v === undefined) return `${k}=undefined`;
    if (v === null) return `${k}=null`;
    return `${k}=${String(v)}`;
  });
  getChannel().appendLine(`[${new Date().toISOString()}] ${scope} | ${parts.join(', ')}`);
}
