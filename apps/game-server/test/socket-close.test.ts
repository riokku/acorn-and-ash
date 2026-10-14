import { expect, it } from 'vitest';
import { SELF } from 'cloudflare:test';
import { TestClient, waitFor } from './helpers';

it('completes a client-initiated close handshake and stops the empty world', async () => {
  const id = `close-handshake-${crypto.randomUUID()}`;
  const client = await TestClient.connect(id);
  await waitFor('welcome', () => client.received.some((m) => m.type === 'welcome'));
  client.close();
  await waitFor('server close reply', () => client.closedWith !== null);
  expect(client.closedWith).toBe(1000);
  const response = await SELF.fetch(`https://game.test/worlds/${id}/status`);
  expect(await response.json()).toMatchObject({ players: 0, running: false });
});
