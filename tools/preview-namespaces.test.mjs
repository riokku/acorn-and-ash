import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewNamespaces } from './preview-namespaces.mjs';
const options = {
  repository: 'riokku/acorn-and-ash',
  githubToken: 'test-gh',
  cloudflareToken: 'test-cf',
  accountId: 'test-account',
};
test('reports only verified same-repository preview classes and never mutates anything', async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/namespaces?'))
      return Response.json({
        success: true,
        result: [
          { script: 'acorn-ash-game-server-pr-210', class: 'World' },
          { script: 'acorn-ash-game-server-pr-211', class: 'ItemCatalog' },
          { script: 'acorn-ash-game-server-staging', class: 'World' },
        ],
      });
    if (url.includes('api.github.com')) {
      const number = Number(url.split('/').at(-1));
      return Response.json({
        number,
        state: number === 210 ? 'closed' : 'open',
        head: { repo: { full_name: options.repository } },
      });
    }
    return new Response(null, { status: 404 });
  };
  const report = await previewNamespaces({ ...options, request });
  assert.equal(report.total, 3);
  assert.equal(report.previews[0].workerExists, false);
  assert.equal(report.previews[1].state, 'open');
  assert.equal(report.unclassified[0].script, 'acorn-ash-game-server-staging');
  assert.equal(
    calls.every((call) => call.init.method === undefined),
    true,
  );
});
test('fails closed on an unavailable API or a preview from a fork', async () => {
  await assert.rejects(
    previewNamespaces({ ...options, request: async () => new Response(null, { status: 403 }) }),
    /HTTP 403/,
  );
  const request = async (url) =>
    Response.json(
      url.includes('api.github.com')
        ? { number: 210, state: 'closed', head: { repo: { full_name: 'another/fork' } } }
        : { success: true, result: [{ script: 'acorn-ash-game-server-pr-210', class: 'World' }] },
    );
  await assert.rejects(previewNamespaces({ ...options, request }), /ownership/);
});
