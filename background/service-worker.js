chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('beginnerModeEnabled', ({ beginnerModeEnabled }) => {
    if (typeof beginnerModeEnabled === 'undefined') {
      chrome.storage.sync.set({ beginnerModeEnabled: true });
    }
  });
});
