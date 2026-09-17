(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class IncrementalObserver {
    constructor(onAddedRoot) {
      this.onAddedRoot = onAddedRoot;
      this.pending = new Set();
      this.timer = null;
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (!element || element.closest?.('[data-estat-beginner-ignore], .estat-beginner-term')) return;
            this.pending.add(node.nodeType === Node.TEXT_NODE ? element : node);
          });
        }
        if (this.pending.size && !this.timer) {
          this.timer = setTimeout(() => this.flush(), 100);
        }
      });
    }

    start() {
      if (document.body) this.observer.observe(document.body, { childList: true, subtree: true });
    }

    flush() {
      const roots = [...this.pending];
      this.pending.clear();
      this.timer = null;
      roots.filter((root) => root.isConnected).forEach(this.onAddedRoot);
    }

    stop() {
      this.observer.disconnect();
      clearTimeout(this.timer);
      this.pending.clear();
      this.timer = null;
    }
  }

  app.IncrementalObserver = IncrementalObserver;
})();
