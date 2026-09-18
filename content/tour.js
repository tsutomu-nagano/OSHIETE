(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class EstatTour {
    constructor() {
      this.pages = [];
      this.instance = null;
    }

    async load() {
      const response = await fetch(chrome.runtime.getURL('dictionary/pages.json'));
      if (!response.ok) throw new Error(`画面ガイドを読み込めませんでした (${response.status})`);
      this.pages = await response.json();
      if (!Array.isArray(this.pages)) throw new Error('画面ガイドの形式が正しくありません');
    }

    findElement(step) {
      for (const selector of step.selectors || (step.selector ? [step.selector] : [])) {
        try {
          const element = document.querySelector(selector);
          if (element && this.isVisible(element)) return element;
        } catch (error) {
          console.debug('[e-Stat初心者モード] 無効なツアー用セレクターです。', selector, error);
        }
      }
      if (step.text) {
        const candidates = document.querySelectorAll(step.text.selector || 'body *');
        return [...candidates].find((element) =>
          this.isVisible(element) && element.textContent?.includes(step.text.includes)
        ) || null;
      }
      return null;
    }

    isVisible(element) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    pageDefinition() {
      const path = location.pathname;
      return this.pages.find((page) => page.urlPattern !== '.*' && new RegExp(page.urlPattern).test(path))
        || this.pages.find((page) => page.urlPattern === '.*');
    }

    start() {
      const createDriver = globalThis.driver?.js?.driver;
      if (typeof createDriver !== 'function') throw new Error('Driver.jsを利用できません');
      this.instance?.destroy();

      const page = this.pageDefinition();
      const steps = (page?.elements || []).flatMap((step) => {
        const element = this.findElement(step);
        if ((step.selector || step.selectors || step.text) && !element) return [];
        return [{
          ...(element ? { element } : {}),
          popover: {
            title: step.title,
            description: step.description,
            side: step.side || 'bottom',
            align: step.align || 'start'
          }
        }];
      });
      if (!steps.length) return false;

      this.instance = createDriver({
        steps,
        showProgress: true,
        progressText: '{{current}} / {{total}}',
        nextBtnText: '次へ',
        prevBtnText: '戻る',
        doneBtnText: '完了',
        allowClose: true,
        overlayColor: '#163449',
        overlayOpacity: 0.62,
        stagePadding: 8,
        stageRadius: 8,
        popoverClass: 'estat-driver-popover',
        onDestroyed: () => { this.instance = null; }
      });
      this.instance.drive();
      return true;
    }
  }

  app.EstatTour = EstatTour;
})();
