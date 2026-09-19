import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { DEFAULT_WORLD_ID, isValidWorldId } from '../src/worlds';

describe('the API', () => {
  it('answers a health check', async () => {
    const response = await SELF.fetch('https://acorn.test/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: 'web' });
  });

  it('tells the client where to connect', async () => {
    const response = await SELF.fetch('https://acorn.test/api/config');
    expect(await response.json()).toEqual({
      defaultWorldId: DEFAULT_WORLD_ID,
      realtimePath: '/api/worlds/{worldId}/ws',
    });
  });

  it('answers an unknown API route with 404, not with the game', async () => {
    const response = await SELF.fetch('https://acorn.test/api/nonsense');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});

describe('reaching the World Durable Object', () => {
  it('forwards a realtime connection to the world', async () => {
    const response = await SELF.fetch(`https://acorn.test/api/worlds/${DEFAULT_WORLD_ID}/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    // The stub world stands in for the game server Worker here; what matters is
    // that the binding resolved and the upgrade header survived the hop.
    expect(await response.json()).toMatchObject({
      stub: true,
      path: `/api/worlds/${DEFAULT_WORLD_ID}/ws`,
      upgrade: 'websocket',
    });
  });

  it('sends two players in the same world to the same object', async () => {
    const first = await SELF.fetch(`https://acorn.test/api/worlds/${DEFAULT_WORLD_ID}/status`);
    const second = await SELF.fetch(`https://acorn.test/api/worlds/${DEFAULT_WORLD_ID}/status`);
    const firstBody = (await first.json()) as { objectId: string };
    const secondBody = (await second.json()) as { objectId: string };
    expect(firstBody.objectId).toBe(secondBody.objectId);
  });

  it('sends different worlds to different objects', async () => {
    const first = await SELF.fetch('https://acorn.test/api/worlds/home-clearing/status');
    const second = await SELF.fetch('https://acorn.test/api/worlds/another-world/status');
    const firstBody = (await first.json()) as { objectId: string };
    const secondBody = (await second.json()) as { objectId: string };
    expect(firstBody.objectId).not.toBe(secondBody.objectId);
  });

  it('refuses a world name that is not a world name', async () => {
    const response = await SELF.fetch('https://acorn.test/api/worlds/..%2Fetc/status');
    expect(response.status).toBe(404);
  });
});

describe('world names', () => {
  it('accepts the names we use', () => {
    expect(isValidWorldId('home-clearing')).toBe(true);
    expect(isValidWorldId('world-42')).toBe(true);
  });

  it('rejects anything that could be used to make junk worlds', () => {
    // Every distinct name would spin up its own Durable Object.
    expect(isValidWorldId('')).toBe(false);
    expect(isValidWorldId('ab')).toBe(false);
    expect(isValidWorldId('-leading-dash')).toBe(false);
    expect(isValidWorldId('Upper-Case')).toBe(false);
    expect(isValidWorldId('has spaces')).toBe(false);
    expect(isValidWorldId('../etc/passwd')).toBe(false);
    expect(isValidWorldId('a'.repeat(64))).toBe(false);
  });
});

describe('serving the game', () => {
  it('serves the client for any other path', async () => {
    const response = await SELF.fetch('https://acorn.test/');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>');
  });
});
