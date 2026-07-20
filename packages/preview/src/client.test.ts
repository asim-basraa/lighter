// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTokenCss } from './client.js';
import { TOKEN_STYLE_ID } from './protocol.js';

describe('applyTokenCss', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('creates one style element and reuses it', () => {
    applyTokenCss(':root{--primary-default:#f00}');
    applyTokenCss(':root{--primary-default:#0f0}');
    const found = document.head.querySelectorAll(`#${TOKEN_STYLE_ID}`);
    // Reused, not stacked — otherwise every keystroke leaks a <style> and the last one wins by luck.
    expect(found.length).toBe(1);
    expect(found[0]!.textContent).toBe(':root{--primary-default:#0f0}');
  });

  it('stays last in <head> so later stylesheets cannot outrank the override', () => {
    applyTokenCss(':root{--x:1}');
    document.head.append(document.createElement('link'));
    applyTokenCss(':root{--x:2}');
    expect((document.head.lastElementChild as HTMLElement).id).toBe(TOKEN_STYLE_ID);
  });

  it('accepts empty css, which is how the studio clears an override', () => {
    applyTokenCss(':root{--x:1}');
    applyTokenCss('');
    expect(document.getElementById(TOKEN_STYLE_ID)?.textContent).toBe('');
  });
});
