(() => {
  'use strict';

  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};
  const SKIPPED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE',
    'SVG', 'CANVAS', 'NOSCRIPT', 'IFRAME'
  ]);

  class TermMarker {
    constructor(terms, onCountChange) {
      this.termsById = new Map(terms.map((term) => [term.id, term]));
      this.matches = terms.flatMap((term) => [term.term, ...(term.aliases || [])]
        .filter(Boolean)
        .map((label) => ({ label, term })))
        .sort((a, b) => b.label.length - a.label.length);
      this.pattern = this.matches.length
        ? new RegExp(this.matches.map(({ label }) => this.escapeRegExp(label)).join('|'), 'g')
        : null;
      this.matchByLabel = new Map(this.matches.map((match) => [match.label, match.term]));
      this.count = 0;
      this.onCountChange = onCountChange;
    }

    escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    shouldSkipElement(element) {
      return !element || SKIPPED_TAGS.has(element.tagName) ||
        element.isContentEditable ||
        element.closest('[contenteditable="true"], [data-estat-beginner-ignore], .estat-beginner-term, #estat-beginner-extension-root');
    }

    markRoot(root) {
      if (!this.pattern || !root?.isConnected ||
          (root.nodeType === Node.ELEMENT_NODE && this.shouldSkipElement(root))) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue?.trim() || this.shouldSkipElement(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          this.pattern.lastIndex = 0;
          return this.pattern.test(node.nodeValue)
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
      let added = 0;
      this.pattern.lastIndex = 0;

      for (const match of text.matchAll(this.pattern)) {
        if (match.index > cursor) fragment.append(text.slice(cursor, match.index));
        const term = this.matchByLabel.get(match[0]);
        const span = document.createElement('span');
        span.className = 'estat-beginner-term';
        span.dataset.estatTermId = term.id;
        span.dataset.estatBeginnerProcessed = 'true';
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', `${term.term}の説明を表示`);
        span.textContent = match[0];
        fragment.append(span);
        cursor = match.index + match[0].length;
        added += 1;
      }

      if (!added) return;
      if (cursor < text.length) fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
      this.count += added;
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
