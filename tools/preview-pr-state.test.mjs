import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewPrState } from './preview-pr-state.mjs';

const options = {
  repository: 'riokku/acorn-and-ash',
  number: 210,
  githubToken: 'test-gh',
  accountId: 'test-account',
  cloudflareToken: 'test-cf',
  worker: 'acorn-ash-game-server-pr-210',
};
function requests(state, workerStatus = 200) {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return url.startsWith('https://api.github.com')
      ? Response.json({ number: 210, head: { repo: { full_name: options.repository } }, state })
      : new Response('', { status: workerStatus });
  };
  return { request, calls };
}
test('an open PR needs its preview and never queries Cloudflare', async () => {
  const mock = requests('open');
  assert.deepEqual(await previewPrState({ ...options, ...mock }), { open: true, remove: false });
  assert.equal(mock.calls.length, 1);
});
test('closure after deployment selects only the verified PR preview for existing cleanup', async () => {
  const mock = requests('closed');
  assert.deepEqual(await previewPrState({ ...options, ...mock }), { open: false, remove: true });
  assert.equal(
    mock.calls[1].url,
    'https://api.cloudflare.com/client/v4/accounts/test-account/workers/scripts/acorn-ash-game-server-pr-210',
  );
  assert.equal(
    mock.calls.every(({ init }) => init.method === undefined),
    true,
  );
});
test('closure before deployment is a quiet missing-preview result', async () => {
  const mock = requests('closed', 404);
  assert.deepEqual(await previewPrState({ ...options, ...mock }), { open: false, remove: false });
});
test('does not treat authentication or service failures as missing previews', async () => {
  for (const status of [403, 429, 500]) {
    const mock = requests('closed', status);
    await assert.rejects(
      previewPrState({ ...options, ...mock }),
      /Cannot verify closed preview Worker/,
    );
  }
});
test('cannot select staging, production, another PR or an invalid identity', async () => {
  for (const worker of [
    'acorn-ash-game-server-staging',
    'acorn-ash-game-server',
    'acorn-ash-game-server-pr-209',
  ]) {
    await assert.rejects(previewPrState({ ...options, worker }), /Unexpected preview Worker/);
  }
  await assert.rejects(previewPrState({ ...options, number: NaN }), /Invalid preview/);
});
test('rejects unverified PR ownership or state', async () => {
  for (const pr of [
    { number: 211, head: { repo: { full_name: options.repository } }, state: 'closed' },
    { number: 210, head: { repo: { full_name: 'someone/fork' } }, state: 'closed' },
    { number: 210, head: { repo: { full_name: options.repository } }, state: 'unknown' },
  ])
    await assert.rejects(previewPrState({ ...options, request: async () => Response.json(pr) }));
});
