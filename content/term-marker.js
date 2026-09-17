(() => {
  'use strict';

  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};
  const SKIPPED_TAGS = new Set([
    'A', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE',
    'SVG', 'CANVAS', 'NOSCRIPT', 'IFRAME'
  ]);

  class TermMarker {
    constructor(terms, onCountChange) {
      this.termsById = new Map(terms.map((term) => [term.id, term]));
      this.matches = terms.flatMap((term) => [term.term, ...(term.aliases || [])]
        .filter(Boolean)
        .map((label) => ({ label, term })))
        .sort((a, b) => b.label.length - a.label.length);
      this.matcher = this.matches.length ? new app.AhoCorasickMatcher(this.matches) : null;
      this.count = 0;
      this.onCountChange = onCountChange;
    }

    shouldSkipElement(element) {
      return !element || SKIPPED_TAGS.has(element.tagName) ||
        element.isContentEditable ||
        element.closest('a, .stat-filter-list-item, [contenteditable="true"], [data-estat-beginner-ignore], .estat-beginner-term, #estat-beginner-extension-root');
    }

    markRoot(root) {
      if (!this.matcher || !root?.isConnected ||
          (root.nodeType === Node.ELEMENT_NODE && this.shouldSkipElement(root))) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue?.trim() || this.shouldSkipElement(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          return this.matcher.hasMatch(node.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach((node) => this.markTextNode(node));
    }

    markTextNode(node) {
      if (!node.parentNode || this.shouldSkipElement(node.parentElement)) return;
      const text = node.nodeValue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      const matches = this.matcher.findAll(text);

      for (const match of matches) {
        if (match.start > cursor) fragment.append(text.slice(cursor, match.start));
        const term = match.term;
        const span = document.createElement('span');
        span.className = 'estat-beginner-term';
        span.dataset.estatTermId = term.id;
        span.dataset.estatBeginnerProcessed = 'true';
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', `${term.term}の説明を表示`);
        span.textContent = match.label;
        fragment.append(span);
        cursor = match.end;
      }

      if (!matches.length) return;
      if (cursor < text.length) fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
      this.count += matches.length;
      this.onCountChange?.(this.count);
    }

    clear() {
      const parents = new Set();
      document.querySelectorAll('.estat-beginner-term[data-estat-term-id]').forEach((span) => {
        const parent = span.parentNode;
        parents.add(parent);
        span.replaceWith(document.createTextNode(span.textContent));
      });
      parents.forEach((parent) => parent?.normalize());
      this.count = 0;
      this.onCountChange?.(0);
    }

    getTerm(id) {
      return this.termsById.get(id);
    }
  }

  app.TermMarker = TermMarker;
})();
