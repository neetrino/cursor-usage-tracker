import * as vscode from 'vscode';
import { readQueue } from './storage';
import { renderSettingsWebviewHtml } from './settingsWebviewHtml';
import { buildWebviewState } from './settingsWebviewState';
import { handleSettingsWebviewMessage } from './settingsWebviewHandlers';

let activePanel: vscode.WebviewPanel | undefined;

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export function openSettingsWebview(
  context: vscode.ExtensionContext,
  onSettingsChanged: () => void | Promise<void>,
): void {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    void refreshPanel(context, activePanel);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'cursorUsageTrackerSettings',
    'Cursor Usage Tracker Settings',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  activePanel = panel;

  const nonce = getNonce();
  void (async () => {
    const state = await buildWebviewState(context);
    panel.webview.html = renderSettingsWebviewHtml({
      nonce,
      cspSource: panel.webview.cspSource,
      initialStateJson: JSON.stringify(state).replace(/<\/script>/gi, '<\\/script>'),
    });
  })();

  panel.onDidDispose(() => {
    activePanel = undefined;
  });

  panel.webview.onDidReceiveMessage(
    (msg: unknown) => {
      void handleSettingsWebviewMessage(context, panel, msg, onSettingsChanged);
    },
    undefined,
    context.subscriptions,
  );
}

async function refreshPanel(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
  const state = await buildWebviewState(context);
  panel.webview.postMessage({ type: 'applyState', state });
}

export async function openPendingJsonPreview(context: vscode.ExtensionContext): Promise<void> {
  const q = await readQueue(context);
  const doc = await vscode.workspace.openTextDocument({
    content: JSON.stringify(q, null, 2),
    language: 'json',
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
