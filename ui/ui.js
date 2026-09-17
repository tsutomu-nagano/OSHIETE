(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class BeginnerUI {
    constructor(getTerm) {
      this.getTerm = getTerm;
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
      if (!element) return;
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

    createSection(title, values) {
      if (!values?.length) return null;
      const section = document.createElement('section');
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
      content.append(title, category, lead, detailTitle, detail);
      const examples = this.createSection('例', term.examples);
      const related = this.createSection('関連用語', term.relatedTerms);
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
      this.host = this.shadow = this.tooltip = this.drawer = null;
    }
  }

  app.BeginnerUI = BeginnerUI;
})();
