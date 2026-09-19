(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class FeatureHints {
    constructor() {
      this.definitions = [];
      this.beacons = [];
      this.instance = null;
      this.observer = null;
      this.refreshTimer = null;
      this.urlTimer = null;
      this.startupTimers = [];
      this.enabled = false;
      this.currentUrl = location.href;
      this.boundPosition = () => this.positionBeacons();
    }

    async load() {
      const response = await fetch(chrome.runtime.getURL('dictionary/feature-hints.json'));
      if (!response.ok) throw new Error(`Feature Hintを読み込めませんでした (${response.status})`);
      this.definitions = await response.json();
      if (!Array.isArray(this.definitions)) throw new Error('Feature Hintの形式が正しくありません');
    }

    start() {
      if (this.enabled) return;
      this.enabled = true;
      this.observer = new MutationObserver(() => this.scheduleRefresh());
      this.observer.observe(document.body, { childList: true, subtree: true });
      addEventListener('resize', this.boundPosition, { passive: true });
      addEventListener('scroll', this.boundPosition, { passive: true, capture: true });
      addEventListener('popstate', this.boundUrlChange = () => this.scheduleRefresh());
      addEventListener('hashchange', this.boundUrlChange);
      this.urlTimer = setInterval(() => {
        if (this.currentUrl !== location.href) {
          this.currentUrl = location.href;
          this.scheduleRefresh();
        }
      }, 500);
      this.refresh();
      this.startupTimers = [1000, 3000].map((delay) =>
        setTimeout(() => this.refresh(), delay)
      );
    }

    stop() {
      this.enabled = false;
      this.observer?.disconnect();
      this.observer = null;
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      clearInterval(this.urlTimer);
      this.urlTimer = null;
      this.startupTimers.forEach(clearTimeout);
      this.startupTimers = [];
      removeEventListener('resize', this.boundPosition);
      removeEventListener('scroll', this.boundPosition, true);
      removeEventListener('popstate', this.boundUrlChange);
      removeEventListener('hashchange', this.boundUrlChange);
      this.clear();
    }

    scheduleRefresh() {
      if (!this.enabled || this.refreshTimer) return;
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        if (this.currentUrl !== location.href) this.currentUrl = location.href;
        this.refresh();
      }, 200);
    }

    matchingHints() {
      return this.definitions.flatMap((page) => {
        try {
          return new RegExp(page.urlPattern).test(location.pathname) ? (page.hints || []) : [];
        } catch (error) {
          console.debug('[e-Stat初心者モード] 無効なFeature Hint URLパターンです。', page.urlPattern, error);
          return [];
        }
      });
    }

    findTarget(hint) {
      for (const selector of hint.selectors || (hint.selector ? [hint.selector] : [])) {
        try {
          const target = document.querySelector(selector);
          if (target && this.isVisible(target)) return target;
        } catch (error) {
          console.debug('[e-Stat初心者モード] 無効なFeature Hintセレクターです。', selector, error);
        }
      }
      return null;
    }

    isVisible(element) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    refresh() {
      if (!this.enabled) return;
      const resolved = this.matchingHints().flatMap((hint) => {
        const target = this.findTarget(hint);
        return target ? [{ hint, target }] : [];
      });
      const signature = resolved.map(({ hint, target }) => `${hint.id}:${this.elementPath(target)}`).join('|');
      if (signature === this.signature && this.beacons.every(({ button }) => button.isConnected)) {
        this.positionBeacons();
        return;
      }
      this.clear();
      this.signature = signature;
      resolved.forEach(({ hint, target }) => this.createBeacon(hint, target));
      this.positionBeacons();
    }

    elementPath(element) {
      const parts = [];
      for (let node = element; node && node !== document.body; node = node.parentElement) {
        parts.push(`${node.tagName}:${[...node.parentElement.children].indexOf(node)}`);
      }
      return parts.join('/');
    }

    createBeacon(hint, target) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'estat-wakaba-beacon';
      button.dataset.estatBeginnerIgnore = '';
      button.dataset.hintId = hint.id;
      button.setAttribute('aria-label', `${hint.popover.title}の初心者向けヒントを表示`);
      button.title = hint.popover.title;

      const fallback = document.createElement('span');
      fallback.className = 'estat-wakaba-beacon-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = '🌱';

      const image = document.createElement('img');
      image.className = 'estat-wakaba-beacon-image';
      image.alt = '';
      image.addEventListener('load', () => { fallback.hidden = true; }, { once: true });
      image.addEventListener('error', () => { image.remove(); }, { once: true });
      image.src = chrome.runtime.getURL('icons/wakaba.svg');
      button.append(fallback, image);
      button.addEventListener('click', () => this.showHint(hint, target));
      document.body.append(button);
      this.beacons.push({ button, hint, target });
    }

    positionBeacons() {
      requestAnimationFrame(() => {
        this.beacons.forEach(({ button, hint, target }) => {
          if (!target.isConnected || !this.isVisible(target)) {
            button.hidden = true;
            return;
          }
          button.hidden = false;
          const targetRect = target.getBoundingClientRect();
          if (targetRect.bottom < 0 || targetRect.top > innerHeight || targetRect.right < 0 || targetRect.left > innerWidth) {
            button.hidden = true;
            return;
          }
          const config = hint.beacon || {};
          const size = 30;
          const x = config.align === 'start' ? targetRect.left :
            config.align === 'center' ? targetRect.left + targetRect.width / 2 - size / 2 : targetRect.right - size;
          const y = config.side === 'bottom' ? targetRect.bottom - size / 2 :
            config.side === 'left' || config.side === 'right' ? targetRect.top + targetRect.height / 2 - size / 2 : targetRect.top - size / 2;
          button.style.left = `${Math.max(4, Math.min(innerWidth - size - 4, x + (config.offsetX || 0)))}px`;
          button.style.top = `${Math.max(4, Math.min(innerHeight - size - 4, y + (config.offsetY || 0)))}px`;
        });
      });
    }

    showHint(hint, target) {
      const createDriver = globalThis.driver?.js?.driver;
      if (typeof createDriver !== 'function' || !target.isConnected) return;
      this.instance?.destroy();
      const instance = createDriver({
        allowClose: true,
        overlayColor: '#163449',
        overlayOpacity: 0.25,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: 'estat-feature-hint-popover',
        onPopoverRender: (popover) => {
          popover.wrapper.dataset.estatBeginnerIgnore = '';
        },
        onDestroyed: () => {
          if (this.instance === instance) this.instance = null;
        }
      });
      this.instance = instance;
      instance.highlight({
        element: target,
        popover: {
          title: hint.popover.title,
          description: hint.popover.description,
          side: hint.popover.side || 'bottom',
          align: hint.popover.align || 'start'
        }
      });
    }

    clear() {
      this.instance?.destroy();
      this.instance = null;
      this.beacons.forEach(({ button }) => button.remove());
      this.beacons = [];
      this.signature = '';
    }

    get count() {
      return this.beacons.filter(({ button }) => !button.hidden).length;
    }
  }

  app.FeatureHints = FeatureHints;
})();
