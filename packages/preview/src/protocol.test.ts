import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  asParentMessage,
  asFrameMessage,
  isCompatible,
} from './protocol.js';

/**
 * These guards sit on an untrusted boundary — anything on the page can postMessage at us. They must
 * reject junk without throwing, because a throw inside a message listener is an unhandled rejection
 * in the previewed app, not a caught error in Lighter.
 */
describe('asParentMessage', () => {
  it('accepts well-formed messages', () => {
    expect(asParentMessage({ type: 'lighter:ready', protocol: 1 })?.type).toBe('lighter:ready');
    expect(asParentMessage({ type: 'lighter:spec', screenId: 'cart', version: 2, spec: {} })?.type).toBe('lighter:spec');
    expect(asParentMessage({ type: 'lighter:tokens', css: ':root{}' })?.type).toBe('lighter:tokens');
    expect(asParentMessage({ type: 'lighter:refresh' })?.type).toBe('lighter:refresh');
  });

  it('rejects messages missing their required field', () => {
    expect(asParentMessage({ type: 'lighter:ready' })).toBeNull();
    expect(asParentMessage({ type: 'lighter:spec', spec: {} })).toBeNull();
    expect(asParentMessage({ type: 'lighter:tokens' })).toBeNull();
  });

  it('ignores foreign traffic instead of throwing', () => {
    // Real pages are noisy: React DevTools, Vite HMR, wallet extensions all postMessage.
    for (const junk of [null, undefined, 'hello', 42, [], { type: 'webpackHotUpdate' }, {}]) {
      expect(asParentMessage(junk)).toBeNull();
    }
  });
});

describe('asFrameMessage', () => {
  it('accepts the frame-side messages', () => {
    expect(asFrameMessage({ type: 'lighter:hello', protocol: 1, sdkVersion: '0.1.0', screenId: null, path: '/' })?.type).toBe('lighter:hello');
    expect(asFrameMessage({ type: 'lighter:navigated', screenId: 'cart', path: '/cart' })?.type).toBe('lighter:navigated');
    expect(asFrameMessage({ type: 'lighter:error', message: 'bad spec' })?.type).toBe('lighter:error');
  });

  it('rejects a hello with no protocol version — we could not tell if we can drive it', () => {
    expect(asFrameMessage({ type: 'lighter:hello', sdkVersion: '0.1.0' })).toBeNull();
  });
});

describe('isCompatible', () => {
  it('accepts its own version and refuses others', () => {
    expect(isCompatible(PROTOCOL_VERSION)).toBe(true);
    expect(isCompatible(PROTOCOL_VERSION + 1)).toBe(false);
    expect(isCompatible(0)).toBe(false);
  });
});
