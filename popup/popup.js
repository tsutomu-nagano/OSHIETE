(() => {
  'use strict';
  const toggle = document.querySelector('#mode-toggle');
  const count = document.querySelector('#term-count');
  const notice = document.querySelector('#notice');
  const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  async function refreshStatus() {
    const { beginnerModeEnabled } = await chrome.storage.sync.get({ beginnerModeEnabled: true });
    toggle.checked = beginnerModeEnabled;
    const tab = await activeTab();
    if (!tab?.url?.startsWith('https://www.e-stat.go.jp/')) {
      count.textContent = '0'; notice.textContent = 'e-Statのページで利用できます。'; return;
    }
    try {
      const status = await chrome.tabs.sendMessage(tab.id, { type: 'ESTAT_BEGINNER_GET_STATUS' });
      count.textContent = String(status?.count ?? 0);
      notice.textContent = beginnerModeEnabled ? '' : '初心者モードはOFFです。';
    } catch {
      const key = `detectedCount:${tab.url}`;
      const values = await chrome.storage.local.get(key);
      count.textContent = String(values[key] ?? 0);
      notice.textContent = 'ページを再読み込みすると利用できます。';
    }
  }

  toggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ beginnerModeEnabled: toggle.checked });
    notice.textContent = toggle.checked ? '初心者モードをONにしました。' : '初心者モードをOFFにしました。';
    setTimeout(refreshStatus, 150);
  });
  refreshStatus();
})();
