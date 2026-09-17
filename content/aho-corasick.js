(() => {
  'use strict';

  const app = globalThis.EstatBeginner = globalThis.EstatBeginner || {};

  class AhoCorasickMatcher {
    constructor(entries) {
      this.nodes = [this.createNode()];
      entries.forEach((entry, order) => this.add(entry.label, entry.term, order));
      this.buildFailureLinks();
    }

    createNode() {
      return { next: new Map(), failure: 0, outputs: [] };
    }

    add(label, term, order) {
      let state = 0;
      for (let index = 0; index < label.length; index += 1) {
        const character = label[index];
        if (!this.nodes[state].next.has(character)) {
          this.nodes[state].next.set(character, this.nodes.length);
          this.nodes.push(this.createNode());
        }
        state = this.nodes[state].next.get(character);
      }
      this.nodes[state].outputs.push({ label, term, order });
    }

    buildFailureLinks() {
      const queue = [];
      this.nodes[0].next.forEach((state) => queue.push(state));

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const state = queue[cursor];
        this.nodes[state].next.forEach((nextState, character) => {
          queue.push(nextState);
          let fallback = this.nodes[state].failure;
          while (fallback !== 0 && !this.nodes[fallback].next.has(character)) {
            fallback = this.nodes[fallback].failure;
          }
          const failureState = this.nodes[fallback].next.get(character);
          this.nodes[nextState].failure = failureState ?? 0;
          this.nodes[nextState].outputs.push(
            ...this.nodes[this.nodes[nextState].failure].outputs
          );
        });
      }
    }

    findAll(text) {
      const matches = [];
      let state = 0;

      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        while (state !== 0 && !this.nodes[state].next.has(character)) {
          state = this.nodes[state].failure;
        }
        state = this.nodes[state].next.get(character) ?? 0;

        this.nodes[state].outputs.forEach((output) => {
          matches.push({
            start: index - output.label.length + 1,
            end: index + 1,
            label: output.label,
            term: output.term,
            order: output.order
          });
        });
      }

      return this.selectNonOverlapping(matches);
    }

    selectNonOverlapping(matches) {
      matches.sort((a, b) =>
        a.start - b.start ||
        (b.end - b.start) - (a.end - a.start) ||
        a.order - b.order
      );

      const selected = [];
      let nextAvailableIndex = 0;
      matches.forEach((match) => {
        if (match.start < nextAvailableIndex) return;
        selected.push(match);
        nextAvailableIndex = match.end;
      });
      return selected;
    }

    hasMatch(text) {
      let state = 0;
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        while (state !== 0 && !this.nodes[state].next.has(character)) {
          state = this.nodes[state].failure;
        }
        state = this.nodes[state].next.get(character) ?? 0;
        if (this.nodes[state].outputs.length) return true;
      }
      return false;
    }
  }

  app.AhoCorasickMatcher = AhoCorasickMatcher;
})();
