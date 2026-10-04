import { describe, expect, it } from 'vitest';

import { isTestHost, offeredProviders, testSignInMode } from '../src/accounts/options';
import type { WebEnv } from '../src/env';

/** Only the settings these functions read; the rest of the environment is not their business. */
const settings = (values: Partial<WebEnv>): WebEnv => values as WebEnv;

const BOTH = {
  GOOGLE_CLIENT_ID: 'g-id',
  GOOGLE_CLIENT_SECRET: 'g-secret',
  DISCORD_CLIENT_ID: 'd-id',
  DISCORD_CLIENT_SECRET: 'd-secret',
};

describe('where a test player may sign in', () => {
  it('is your own machine', () => {
    expect(isTestHost('localhost')).toBe(true);
    expect(isTestHost('127.0.0.1')).toBe(true);
    expect(isTestHost('preview.localhost')).toBe(true);
  });

  it('is a pull request preview, which has its alias stuck on the front', () => {
    expect(isTestHost('pr-95-acorn-ash-web-staging.chrisistinson.workers.dev')).toBe(true);
  });

  it('is never the real staging or production address', () => {
    expect(isTestHost('acorn-ash-web-staging.chrisistinson.workers.dev')).toBe(false);
    expect(isTestHost('acorn-ash-web-production.chrisistinson.workers.dev')).toBe(false);
    expect(isTestHost('play.acornandash.example')).toBe(false);
  });

  it('cannot be fooled by a name that merely mentions localhost or the Worker', () => {
    expect(isTestHost('localhost.evil.example')).toBe(false);
    expect(isTestHost('evil.example.com')).toBe(false);
    expect(isTestHost('acorn.chrisistinson.workers.dev')).toBe(false);
  });
});

describe('whether test sign-in is on', () => {
  it('is off unless the setting says so', () => {
    expect(testSignInMode(settings({}), 'localhost')).toBeNull();
    expect(testSignInMode(settings({ TEST_SIGN_IN: 'yes please' }), 'localhost')).toBeNull();
  });

  it('follows the setting on a test address', () => {
    expect(testSignInMode(settings({ TEST_SIGN_IN: 'automatic' }), 'localhost')).toBe('automatic');
    const preview = 'pr-3-acorn-ash-web-staging.me.workers.dev';
    expect(testSignInMode(settings({ TEST_SIGN_IN: 'button' }), preview)).toBe('button');
  });

  it('stays off at a real address even if the setting got there by mistake', () => {
    const staging = 'acorn-ash-web-staging.me.workers.dev';
    expect(testSignInMode(settings({ TEST_SIGN_IN: 'automatic' }), staging)).toBeNull();
    expect(testSignInMode(settings({ TEST_SIGN_IN: 'button' }), staging)).toBeNull();
  });
});

describe('which login services are offered', () => {
  const live = 'acorn-ash-web-staging.me.workers.dev';

  it('is each one that has been given both its id and its secret', () => {
    expect(offeredProviders(settings(BOTH), live)).toEqual(['google', 'discord']);
  });

  it('leaves out one that is only half set up', () => {
    const half = settings({ ...BOTH, DISCORD_CLIENT_SECRET: undefined });
    expect(offeredProviders(half, live)).toEqual(['google']);
    expect(offeredProviders(settings({ GOOGLE_CLIENT_SECRET: 'only-this' }), live)).toEqual([]);
  });

  it('is nothing at all until they have been set up', () => {
    expect(offeredProviders(settings({}), live)).toEqual([]);
  });

  it('is nothing where test sign-in is on, because those addresses are not registered', () => {
    const preview = 'pr-3-acorn-ash-web-staging.me.workers.dev';
    expect(offeredProviders(settings({ ...BOTH, TEST_SIGN_IN: 'button' }), preview)).toEqual([]);
  });
});
