import { describe, it, expect } from 'vitest';
import { resolveConfig, flagValue, UsageError } from './config.js';

describe('resolveConfig (#92)', () => {
  it('prefers flags over env over file', () => {
    const cfg = resolveConfig(
      ['--url', 'http://flag', '--token', 't-flag'],
      { LIGHTER_URL: 'http://env', LIGHTER_TOKEN: 't-env' },
      { url: 'http://file', token: 't-file' },
    );
    expect(cfg).toEqual({ url: 'http://flag', token: 't-flag' });
  });

  it('falls back to env, then to the config file', () => {
    expect(resolveConfig([], { LIGHTER_URL: 'http://env' }, { url: 'http://file' })).toEqual({
      url: 'http://env',
      token: undefined,
    });
    expect(resolveConfig([], {}, { url: 'http://file', token: 't-file' })).toEqual({
      url: 'http://file',
      token: 't-file',
    });
  });

  it('throws UsageError when no endpoint is resolvable', () => {
    expect(() => resolveConfig([], {}, {})).toThrow(UsageError);
  });

  it('flagValue reads a --name value pair', () => {
    expect(flagValue(['--dir', 'build'], '--dir')).toBe('build');
    expect(flagValue(['--dir'], '--dir')).toBeUndefined();
    expect(flagValue([], '--dir')).toBeUndefined();
  });
});
