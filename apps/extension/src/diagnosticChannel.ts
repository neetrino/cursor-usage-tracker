import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/** Always-on diagnostics for uncaught errors (message + stack). No secrets. */
export function getDiagnosticChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Cursor Usage Tracker (Diagnostics)');
  }
  return channel;
}

export function logDiagnosticError(scope: string, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const ch = getDiagnosticChannel();
  ch.appendLine('---');
  ch.appendLine(`[${new Date().toISOString()}] scope=${scope}`);
  ch.appendLine(`[ERROR] ${err.message}`);
  ch.appendLine(`[STACK] ${err.stack ?? 'No stack'}`);
}

export async function runWithDiagnostics<T>(scope: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logDiagnosticError(scope, error);
    throw error;
  }
}

export function runWithDiagnosticsSync<T>(scope: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    logDiagnosticError(scope, error);
    throw error;
  }
}
