export function renderSettingsWebviewHtml(params: {
  nonce: string;
  cspSource: string;
  initialStateJson: string;
}): string {
  const { nonce, cspSource, initialStateJson } = params;
  const csp = [
    `default-src 'none'`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${cspSource}`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cursor Usage Tracker Settings</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px 20px 32px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 16px; }
    h2 { font-size: 0.95rem; font-weight: 600; margin: 24px 0 10px; border-bottom: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent); padding-bottom: 4px; }
    .row { margin-bottom: 12px; }
    label { display: block; margin-bottom: 4px; opacity: 0.95; }
    .hint { font-size: 0.85rem; opacity: 0.75; margin-top: 2px; }
    input, select, textarea {
      width: 100%; max-width: 520px;
      padding: 6px 8px;
      border: 1px solid color-mix(in srgb, var(--vscode-input-foreground) 25%, transparent);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 2px;
    }
    textarea { min-height: 64px; resize: vertical; }
    .err { color: var(--vscode-errorForeground); font-size: 0.8rem; margin-top: 4px; min-height: 1em; }
    .inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .inline input { flex: 1; min-width: 200px; max-width: none; }
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-family: inherit;
      font-size: inherit;
    }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    #toast { margin-top: 12px; padding: 8px 10px; border-radius: 2px; display: none; }
    #toast.show { display: block; background: color-mix(in srgb, var(--vscode-button-background) 35%, transparent); }
    #toast.error { display: block; background: color-mix(in srgb, var(--vscode-errorForeground) 25%, transparent); }
    pre.status { white-space: pre-wrap; font-size: 0.8rem; margin: 0; padding: 10px; background: color-mix(in srgb, var(--vscode-editor-foreground) 6%, transparent); border-radius: 2px; max-width: 720px; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>Cursor Usage Tracker Settings</h1>
  <div id="toast"></div>

  <h2>Backend</h2>
  <div class="row">
    <label for="backendUrl">Backend URL (required)</label>
    <input id="backendUrl" type="text" placeholder="http://localhost:3000" autocomplete="off" />
    <div class="hint">Example: http://localhost:3000</div>
    <div class="err" id="err-backendUrl"></div>
  </div>
  <div class="row">
    <label for="trackerApiKey">Tracker API Key (required, stored securely)</label>
    <input id="trackerApiKey" type="password" autocomplete="off" />
    <div class="hint" id="apiKeyHint"></div>
    <div class="err" id="err-trackerApiKey"></div>
  </div>

  <h2>Cursor usage sync</h2>
  <div class="row">
    <label for="adminApiKey">Admin API Key (required for usage CSV import, stored securely)</label>
    <input id="adminApiKey" type="password" autocomplete="off" />
    <div class="hint" id="adminKeyHint">Matches server ADMIN_API_KEY. Extension fetches Cursor usage CSV every 10 minutes when saved.</div>
    <div class="err" id="err-adminApiKey"></div>
  </div>

  <h2>User identity</h2>
  <div class="row">
    <label for="userKey">User Key (required)</label>
    <input id="userKey" type="text" placeholder="edgar" autocomplete="off" />
    <div class="err" id="err-userKey"></div>
  </div>
  <div class="row">
    <label for="userName">User Name (required)</label>
    <input id="userName" type="text" placeholder="Edgar" autocomplete="off" />
    <div class="err" id="err-userName"></div>
  </div>
  <div class="row">
    <label for="computerId">Computer ID (required)</label>
    <div class="inline">
      <input id="computerId" type="text" placeholder="pc-edgar" autocomplete="off" />
      <button type="button" class="secondary" id="btnGenComputer">Generate Computer ID</button>
    </div>
    <div class="err" id="err-computerId"></div>
  </div>

  <h2>Cursor account</h2>
  <div class="row">
    <label for="owningUser">Cursor owningUser (required)</label>
    <input id="owningUser" type="text" placeholder="289049274" autocomplete="off" />
    <div class="hint">Must match owningUser from Cursor usage JSON.</div>
    <div class="err" id="err-owningUser"></div>
  </div>
  <div class="row">
    <label for="accountGroup">Cursor Account Group</label>
    <select id="accountGroup">
      <option value="ultra_1">ultra_1</option>
      <option value="ultra_2">ultra_2</option>
      <option value="custom">custom</option>
    </select>
    <div id="accountCustomWrap" class="row hidden" style="margin-top:8px;">
      <label for="accountGroupCustom">Custom group label</label>
      <input id="accountGroupCustom" type="text" autocomplete="off" />
    </div>
  </div>

  <h2>Log detection</h2>
  <div class="row">
    <label for="cursorLogPath">Cursor log file path (optional until you use log detection)</label>
    <input id="cursorLogPath" type="text" placeholder="C:\\...\\renderer.log" autocomplete="off" />
    <div class="inline actions" style="margin-top:8px;">
      <button type="button" class="secondary" id="btnAutoDiscover">Auto Discover</button>
      <button type="button" class="secondary" id="btnBrowse">Browse File</button>
      <button type="button" class="secondary" id="btnTestLog">Test Log Detection</button>
    </div>
    <div class="err" id="err-cursorLogPath"></div>
  </div>

  <h2>Status</h2>
  <pre class="status" id="statusBlock"></pre>

  <h2>Actions</h2>
  <div class="actions">
    <button type="button" id="btnSave">Save Settings</button>
    <button type="button" class="secondary" id="btnTestBackend">Test Backend Connection</button>
    <button type="button" class="secondary" id="btnSync">Sync Pending Events</button>
    <button type="button" class="secondary" id="btnClearQueue">Clear Pending Queue</button>
    <button type="button" class="secondary" id="btnReset">Reset Settings</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const INITIAL = ${initialStateJson};

    function $(id) { return document.getElementById(id); }
    function inputVal(id) {
      var el = $(id);
      return (el && typeof el.value === 'string') ? el.value : '';
    }
    function setErr(id, msg) { const el = $(id); if (el) el.textContent = msg || ''; }
    function clearErrors() {
      ['backendUrl','trackerApiKey','adminApiKey','userKey','userName','computerId','owningUser','cursorLogPath'].forEach(function (k) {
        setErr('err-' + k, '');
      });
    }
    function showToast(msg, isError) {
      const t = $('toast');
      if (!t) return;
      t.textContent = msg;
      t.className = isError ? 'error' : 'show';
    }

    function setInput(id, val) {
      var el = $(id);
      if (el && 'value' in el) { el.value = val == null ? '' : String(val); }
    }

    function applyAccountGroup(stored) {
      var sel = $('accountGroup');
      var wrap = $('accountCustomWrap');
      var custom = $('accountGroupCustom');
      if (!sel || !wrap || !custom) return;
      if (stored === 'ultra_1' || stored === 'ultra_2') {
        sel.value = stored;
        wrap.classList.add('hidden');
        custom.value = '';
      } else {
        sel.value = 'custom';
        wrap.classList.remove('hidden');
        custom.value = stored || '';
      }
    }

    function collectForm() {
      var ag = $('accountGroup');
      var agVal = ag && typeof ag.value === 'string' ? ag.value : 'ultra_1';
      var customVal = inputVal('accountGroupCustom').trim();
      return {
        backendUrl: inputVal('backendUrl').trim(),
        trackerApiKey: inputVal('trackerApiKey'),
        adminApiKey: inputVal('adminApiKey'),
        userKey: inputVal('userKey').trim(),
        userName: inputVal('userName').trim(),
        computerId: inputVal('computerId').trim(),
        owningUser: inputVal('owningUser').trim(),
        cursorAccountGroup: agVal,
        customCursorAccountGroup: customVal,
        cursorLogPath: inputVal('cursorLogPath').trim(),
      };
    }

    function renderStatus(s) {
      var el = $('statusBlock');
      if (!el || !s) return;
      var lines = [
        'Extension version: ' + (s.extensionVersion || ''),
        'Pending queue: ' + (s.pendingCount != null ? s.pendingCount : '—'),
        'Log path: ' + (s.logPathDisplay || '—'),
        'Log file exists: ' + (s.logFileExists === true ? 'yes' : s.logFileExists === false ? 'no' : '—'),
        'Last backend check: ' + (s.lastBackend || 'Not tested yet'),
        'Last marker: ' + (s.lastMarker || '—'),
        'Last sync: ' + (s.lastSync || '—'),
        'Last Cursor usage sync: ' + (s.lastCursorUsageSync || '—'),
      ];
      el.textContent = lines.join('\\n');
    }

    function applyState(s) {
      if (!s || !s.settings) return;
      setInput('backendUrl', s.settings.backendUrl);
      setInput('userKey', s.settings.userKey);
      setInput('userName', s.settings.userName);
      setInput('computerId', s.settings.computerId);
      setInput('owningUser', s.settings.owningUser);
      setInput('cursorLogPath', s.settings.cursorLogPath);
      setInput('trackerApiKey', '');
      setInput('adminApiKey', '');
      var hint = $('apiKeyHint');
      if (hint) {
        hint.textContent = s.hasApiKey
          ? 'A key is already saved. Leave blank to keep it; enter a new value to replace.'
          : 'Enter your tracker API key (matches server TRACKER_API_KEY).';
      }
      var adminHint = $('adminKeyHint');
      if (adminHint) {
        adminHint.textContent = s.hasAdminKey
          ? 'Admin key saved. Leave blank to keep it; enter a new value to replace. Fetches Cursor usage CSV every 10 minutes.'
          : 'Enter admin API key (matches server ADMIN_API_KEY) to import usage from Cursor dashboard CSV.';
      }
      applyAccountGroup(s.settings.cursorAccountGroup || 'ultra_1');
      renderStatus(s);
    }

    applyState(INITIAL);

    $('accountGroup').addEventListener('change', function () {
      var wrap = $('accountCustomWrap');
      var ag = $('accountGroup');
      if (!wrap || !ag || typeof ag.value !== 'string') return;
      if (ag.value === 'custom') wrap.classList.remove('hidden');
      else wrap.classList.add('hidden');
    });

    $('btnGenComputer').addEventListener('click', function () {
      vscode.postMessage({ type: 'generateComputerId' });
    });
    $('btnAutoDiscover').addEventListener('click', function () {
      vscode.postMessage({ type: 'autoDiscover' });
    });
    $('btnBrowse').addEventListener('click', function () {
      vscode.postMessage({ type: 'browseFile' });
    });
    $('btnTestLog').addEventListener('click', function () {
      vscode.postMessage({ type: 'testLog', path: inputVal('cursorLogPath').trim() });
    });
    $('btnTestBackend').addEventListener('click', function () {
      vscode.postMessage({ type: 'testBackend', form: collectForm() });
    });
    $('btnSync').addEventListener('click', function () {
      vscode.postMessage({ type: 'syncPending' });
    });
    $('btnClearQueue').addEventListener('click', function () {
      vscode.postMessage({ type: 'clearQueue' });
    });
    $('btnReset').addEventListener('click', function () {
      vscode.postMessage({ type: 'reset' });
    });
    $('btnSave').addEventListener('click', function () {
      clearErrors();
      vscode.postMessage({ type: 'save', form: collectForm() });
    });

    window.addEventListener('message', function (event) {
      var m = event.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'applyState') {
        applyState(m.state);
      }
      if (m.type === 'validationErrors') {
        clearErrors();
        (m.errors || []).forEach(function (e) {
          setErr('err-' + e.field, e.message);
        });
        showToast('Fix the highlighted fields.', true);
      }
      if (m.type === 'toast') {
        showToast(m.message || '', !!m.isError);
      }
      if (m.type === 'setField') {
        if (m.field === 'cursorLogPath') setInput('cursorLogPath', m.value);
        if (m.field === 'computerId') setInput('computerId', m.value);
      }
    });
  </script>
</body>
</html>`;
}
