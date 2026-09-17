(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class BeginnerUI {
    constructor(getTerm, onModeChange) {
      this.getTerm = getTerm;
      this.onModeChange = onModeChange;
      this.host = null;
      this.shadow = null;
      this.tooltip = null;
      this.drawer = null;
      this.tooltipTarget = null;
      this.boundOver = (event) => this.handleOver(event);
      this.boundOut = (event) => this.handleOut(event);
      this.boundClick = (event) => this.handleClick(event);
      this.boundContext = (event) => this.handleContext(event);
      this.boundKeydown = (event) => this.handleKeydown(event);
      this.boundViewport = () => this.hideTooltip();
    }

    async mount() {
      if (this.host) return;
      this.host = document.createElement('div');
      this.host.id = 'estat-beginner-extension-root';
      this.host.dataset.estatBeginnerIgnore = 'true';
      this.shadow = this.host.attachShadow({ mode: 'open' });

      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = chrome.runtime.getURL('ui/styles.css');
      this.shadow.append(stylesheet);

      const shell = document.createElement('div');
      shell.innerHTML = `
        <label class="mode-control">
          <span class="mode-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4.5 4.5h15v11h-8l-4.5 4v-4H4.5z"></path>
              <path d="M9.8 8.7a2.35 2.35 0 0 1 4.58.74c0 1.74-2.38 1.73-2.38 3.06"></path>
              <circle cx="12" cy="14.6" r=".7"></circle>
            </svg>
          </span>
          <span class="mode-label">教えてモード</span>
          <span class="mode-switch">
            <input type="checkbox" role="switch" aria-label="教えてモード">
            <span class="mode-slider" aria-hidden="true"></span>
          </span>
        </label>
        <div class="tooltip" role="tooltip" hidden></div>
        <aside class="drawer" aria-label="用語解説" aria-hidden="true">
          <header>
            <span>用語解説</span>
            <button class="close" type="button" aria-label="用語解説を閉じる">×</button>
          </header>
          <div class="drawer-content"></div>
        </aside>`;
      this.shadow.append(shell);
      this.tooltip = this.shadow.querySelector('.tooltip');
      this.drawer = this.shadow.querySelector('.drawer');
      this.modeToggle = this.shadow.querySelector('.mode-control input');
      this.modeToggle.addEventListener('change', () => {
        this.onModeChange?.(this.modeToggle.checked);
      });
      this.shadow.querySelector('.close').addEventListener('click', () => this.closeDrawer());
      document.documentElement.append(this.host);

      document.addEventListener('mouseover', this.boundOver);
      document.addEventListener('mouseout', this.boundOut);
      document.addEventListener('click', this.boundClick);
      document.addEventListener('contextmenu', this.boundContext);
      document.addEventListener('keydown', this.boundKeydown);
      window.addEventListener('scroll', this.boundViewport, true);
      window.addEventListener('resize', this.boundViewport);
    }

    termElement(event) {
      return event.target instanceof Element ? event.target.closest('.estat-beginner-term') : null;
    }

    handleOver(event) {
      const element = this.termElement(event);
      if (!element || element.contains(event.relatedTarget)) return;
      this.showTooltip(element);
    }

    handleOut(event) {
      const element = this.termElement(event);
      if (!element || element.contains(event.relatedTarget)) return;
      this.hideTooltip();
    }

    handleClick(event) {
      const element = this.termElement(event);
      if (!element) {
        const clickedInsideDrawer = event.composedPath().includes(this.host);
        if (this.drawer?.classList.contains('open') && !clickedInsideDrawer) {
          this.closeDrawer();
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.openDrawer(this.getTerm(element.dataset.estatTermId));
    }

    handleContext(event) {
      const element = this.termElement(event);
      if (!element) return;
      event.preventDefault();
      this.hideTooltip();
      this.openDrawer(this.getTerm(element.dataset.estatTermId));
    }

    handleKeydown(event) {
      const element = this.termElement(event);
      if (element && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.openDrawer(this.getTerm(element.dataset.estatTermId));
      } else if (event.key === 'Escape') {
        this.closeDrawer();
      }
    }

    showTooltip(element) {
      const term = this.getTerm(element.dataset.estatTermId);
      if (!term) return;
      this.tooltipTarget = element;
      this.tooltip.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = term.term;
      const description = document.createElement('span');
      description.textContent = term.shortDescription;
      this.tooltip.append(title, description);
      this.tooltip.hidden = false;

      const rect = element.getBoundingClientRect();
      const tipRect = this.tooltip.getBoundingClientRect();
      const gap = 8;
      let left = rect.left + (rect.width - tipRect.width) / 2;
      left = Math.max(gap, Math.min(left, window.innerWidth - tipRect.width - gap));
      let top = rect.bottom + gap;
      if (top + tipRect.height > window.innerHeight - gap) top = rect.top - tipRect.height - gap;
      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${Math.max(gap, top)}px`;
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hidden = true;
      this.tooltipTarget = null;
    }

    setModeEnabled(enabled) {
      if (this.modeToggle) this.modeToggle.checked = enabled;
      if (!enabled) {
        this.hideTooltip();
        this.closeDrawer();
      }
    }

    createSection(title, values, className) {
      if (!values?.length) return null;
      const section = document.createElement('section');
      section.className = className;
      const heading = document.createElement('h3');
      heading.textContent = title;
      const list = document.createElement('ul');
      values.forEach((value) => {
        const item = document.createElement('li');
        item.textContent = value;
        list.append(item);
      });
      section.append(heading, list);
      return section;
    }

    openDrawer(term) {
      if (!term) return;
      this.hideTooltip();
      const content = this.shadow.querySelector('.drawer-content');
      content.replaceChildren();

      const title = document.createElement('h2');
      title.textContent = term.term;
      const category = document.createElement('p');
      category.className = 'category';
      category.textContent = `カテゴリ：${term.category || '未分類'}`;
      const lead = document.createElement('p');
      lead.className = 'lead';
      lead.textContent = term.shortDescription;
      const detailTitle = document.createElement('h3');
      detailTitle.textContent = '詳しい説明';
      const detail = document.createElement('p');
      detail.textContent = term.description;
      const detailSection = document.createElement('section');
      detailSection.className = 'detail-section';
      detailSection.append(detailTitle, detail);
      content.append(title, category, lead, detailSection);
      const examples = this.createSection('例', term.examples, 'examples-section');
      const related = this.createSection('関連用語', term.relatedTerms, 'related-section');
      if (examples) content.append(examples);
      if (related) content.append(related);

      this.drawer.classList.add('open');
      this.drawer.setAttribute('aria-hidden', 'false');
      this.shadow.querySelector('.close').focus();
    }

    closeDrawer() {
      this.drawer?.classList.remove('open');
      this.drawer?.setAttribute('aria-hidden', 'true');
    }

    unmount() {
      document.removeEventListener('mouseover', this.boundOver);
      document.removeEventListener('mouseout', this.boundOut);
      document.removeEventListener('click', this.boundClick);
      document.removeEventListener('contextmenu', this.boundContext);
      document.removeEventListener('keydown', this.boundKeydown);
      window.removeEventListener('scroll', this.boundViewport, true);
      window.removeEventListener('resize', this.boundViewport);
      this.host?.remove();
      this.host = this.shadow = this.tooltip = this.drawer = this.modeToggle = null;
    }
  }

  app.BeginnerUI = BeginnerUI;
})();
