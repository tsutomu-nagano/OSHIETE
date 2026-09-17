(() => {
  'use strict';
  const app = globalThis.EstatBeginner;
  let marker = null;
  let ui = null;
  let observer = null;
  let enabled = false;
  let operation = Promise.resolve();

  async function loadTerms() {
    const response = await fetch(chrome.runtime.getURL('dictionary/terms.json'));
    if (!response.ok) throw new Error(`辞書を読み込めませんでした (${response.status})`);
    const terms = await response.json();
    if (!Array.isArray(terms)) throw new Error('辞書の形式が正しくありません');
    return terms;
  }

  function saveCount(count) {
    chrome.storage.local.set({ [`detectedCount:${location.href}`]: count });
  }

  async function ensureUI() {
    if (ui) return;
    ui = new app.BeginnerUI(
      (id) => marker?.getTerm(id),
      (nextEnabled) => chrome.storage.sync.set({ beginnerModeEnabled: nextEnabled })
    );
    await ui.mount();
  }

  async function ensureMarker() {
    if (marker) return;
    const terms = await loadTerms();
    marker = new app.TermMarker(terms, saveCount);
  }

  async function enable() {
    if (enabled || !document.body) return;
    try {
      await ensureUI();
      await ensureMarker();
      ui.setModeEnabled(true);
      marker.markRoot(document.body);
      observer = new app.IncrementalObserver((root) => marker?.markRoot(root));
      observer.start();
      enabled = true;
    } catch (error) {
      console.warn('[e-Stat初心者モード] 初期化に失敗しました。e-Stat本体には影響ありません。', error);
      enabled = false;
      ui?.setModeEnabled(false);
    }
  }

  async function disable() {
    await ensureUI();
    observer?.stop();
    observer = null;
    marker?.clear();
    ui.setModeEnabled(false);
    enabled = false;
    saveCount(0);
  }

  function setEnabled(nextEnabled) {
    operation = operation.then(() => nextEnabled ? enable() : disable());
    return operation;
  }

  chrome.storage.sync.get({ beginnerModeEnabled: true }, ({ beginnerModeEnabled }) => {
    setEnabled(beginnerModeEnabled);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.beginnerModeEnabled) {
      setEnabled(Boolean(changes.beginnerModeEnabled.newValue));
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'ESTAT_BEGINNER_GET_STATUS') {
      sendResponse({ enabled, count: marker?.count || 0 });
    }
  });
})();
