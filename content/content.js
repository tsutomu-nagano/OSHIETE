(() => {
  'use strict';
  const app = globalThis.EstatBeginner;
  let marker = null;
  let ui = null;
  let observer = null;
  let tour = null;
  let enabled = false;
  let operation = Promise.resolve();

  async function loadDictionary() {
    const [termsResponse, sourcesResponse] = await Promise.all([
      fetch(chrome.runtime.getURL('dictionary/terms.json')),
      fetch(chrome.runtime.getURL('dictionary/sources.json'))
    ]);
    if (!termsResponse.ok) throw new Error(`辞書を読み込めませんでした (${termsResponse.status})`);
    if (!sourcesResponse.ok) throw new Error(`出典を読み込めませんでした (${sourcesResponse.status})`);
    const [terms, sources] = await Promise.all([termsResponse.json(), sourcesResponse.json()]);
    if (!Array.isArray(terms)) throw new Error('辞書の形式が正しくありません');
    if (!Array.isArray(sources)) throw new Error('出典の形式が正しくありません');

    const sourcesByTermId = new Map();
    sources.forEach((source) => {
      (source.termIds || []).forEach((termId) => {
        const termSources = sourcesByTermId.get(termId) || [];
        termSources.push(source);
        sourcesByTermId.set(termId, termSources);
      });
    });
    return terms.map((term) => ({ ...term, sources: sourcesByTermId.get(term.id) || [] }));
  }

  function saveCount(count) {
    chrome.storage.local.set({ [`detectedCount:${location.href}`]: count });
  }

  async function ensureUI() {
    if (ui) return;
    ui = new app.BeginnerUI(
      (id) => marker?.getTerm(id),
      (nextEnabled) => chrome.storage.sync.set({ beginnerModeEnabled: nextEnabled }),
      (label) => marker?.findTermByLabel(label),
      () => startTour()
    );
    await ui.mount();
  }

  async function ensureTour() {
    if (tour) return;
    tour = new app.EstatTour();
    await tour.load();
  }

  async function startTour() {
    await ensureUI();
    await ensureTour();
    return tour.start();
  }

  async function ensureMarker() {
    if (marker) return;
    const terms = await loadDictionary();
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
    } else if (message?.type === 'ESTAT_BEGINNER_START_TOUR') {
      startTour()
        .then((started) => sendResponse({ started }))
        .catch((error) => {
          console.warn('[e-Stat初心者モード] ツアーを開始できませんでした。', error);
          sendResponse({ started: false });
        });
      return true;
    }
  });
})();
