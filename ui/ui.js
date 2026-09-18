(() => {
  'use strict';
  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class BeginnerUI {
    constructor(getTerm, onModeChange, findTermByLabel, onStartTour) {
      this.getTerm = getTerm;
      this.onModeChange = onModeChange;
      this.findTermByLabel = findTermByLabel;
      this.onStartTour = onStartTour;
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
        <div class="floating-controls">
        <button class="tour-launch" type="button" aria-label="e-Statの使い方ツアーを開始">
          <span aria-hidden="true">▶</span><span>使い方ツアー</span>
        </button>
        <label class="mode-control">
          <span class="mode-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M9.7 9.1a2.5 2.5 0 0 1 4.85.85c0 1.85-2.55 2.05-2.55 3.55"></path>
              <path d="M12 16.8h.01"></path>
            </svg>
          </span>
          <span class="mode-label">教えてモード</span>
          <span class="mode-switch">
            <input type="checkbox" role="switch" aria-label="教えてモード">
            <span class="mode-slider" aria-hidden="true"></span>
          </span>
        </label></div>
        <div class="tooltip" role="tooltip" hidden></div>
        <aside class="drawer" aria-label="用語解説" aria-hidden="true">
          <header>
            <span class="drawer-heading">
              <span class="heading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M11.5 3.5 13 8l4.5 1.5L13 11l-1.5 4.5L10 11 5.5 9.5 10 8zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>
              </span>
              用語解説
            </span>
            <button class="close" type="button">閉じる</button>
          </header>
          <div class="drawer-content"></div>
        </aside>`;
      this.shadow.append(shell);
      this.tooltip = this.shadow.querySelector('.tooltip');
      this.drawer = this.shadow.querySelector('.drawer');
      this.modeToggle = this.shadow.querySelector('.mode-control input');
      this.shadow.querySelector('.tour-launch').addEventListener('click', () => this.onStartTour?.());
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

    createIcon(name) {
      const paths = {
        info: 'M12 10.5v6M12 7.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
        lightbulb: 'M9 18h6M10 22h4M8.2 14.6A6 6 0 1 1 15.8 14.6c-.9.7-1.3 1.5-1.3 2.4h-5c0-.9-.4-1.7-1.3-2.4z',
        link: 'M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1',
        source: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6'
      };
      const iconElement = document.createElement('span');
      iconElement.className = 'heading-icon';
      iconElement.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', paths[name] || paths.info);
      svg.append(path);
      iconElement.append(svg);
      return iconElement;
    }

    createHeading(title, icon, level = 'h3') {
      const heading = document.createElement(level);
      const iconElement = this.createIcon(icon);
      const label = document.createElement('span');
      label.textContent = title;
      heading.append(iconElement, label);
      return heading;
    }

    createSection(title, icon, values, className) {
      if (!values?.length) return null;
      const section = document.createElement('section');
      section.className = className;
      const heading = this.createHeading(title, icon);
      const list = document.createElement('ul');
      values.forEach((value) => {
        const item = document.createElement('li');
        const relatedTerm = className === 'related-section'
          ? this.findTermByLabel?.(value)
          : null;
        if (relatedTerm) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'related-term-link';
          button.textContent = value;
          button.addEventListener('click', () => this.openDrawer(relatedTerm));
          item.append(button);
        } else {
          item.textContent = value;
        }
        list.append(item);
      });
      section.append(heading, list);
      return section;
    }

    createSourcesSection(sources) {
      const section = document.createElement('section');
      section.className = 'sources-section';
      const heading = this.createHeading('出典', 'source');
      if (!sources?.length) {
        const empty = document.createElement('p');
        empty.className = 'source-empty';
        empty.textContent = '出典情報は登録されていません。';
        section.append(heading, empty);
        return section;
      }
      const list = document.createElement('ul');
      sources.forEach((source) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title;
        const metadata = document.createElement('span');
        metadata.className = 'source-metadata';
        metadata.textContent = [source.publisher, source.retrievedAt ? `取得日：${source.retrievedAt}` : '']
          .filter(Boolean).join(' ／ ');
        item.append(link, metadata);
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
      const detailTitle = this.createHeading('詳しい説明', 'info');
      const detail = document.createElement('p');
      detail.textContent = term.description;
      const detailSection = document.createElement('section');
      detailSection.className = 'detail-section';
      detailSection.append(detailTitle, detail);
      content.append(title, category, lead, detailSection);
      const examples = this.createSection('例', 'lightbulb', term.examples, 'examples-section');
      const related = this.createSection('関連用語', 'link', term.relatedTerms, 'related-section');
      const sources = this.createSourcesSection(term.sources);
      if (examples) content.append(examples);
      if (related) content.append(related);
      content.append(sources);

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
