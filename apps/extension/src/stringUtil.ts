export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Safe non-empty string for `vscode.window.show*Message` and webview toasts (avoids `undefined` / empty). */
export function asUiMessage(value: unknown, fallback: string): string {
  const s = asString(value).trim();
  return s.length > 0 ? s : fallback;
}
