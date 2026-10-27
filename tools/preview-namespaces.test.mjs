import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewNamespaces, recoverPreviewCapacity } from './preview-namespaces.mjs';
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

test('checks Worker existence without trying to parse its JavaScript as JSON', async () => {
  const report = await previewNamespaces({
    ...options,
    request: async (url) => {
      if (url.includes('/namespaces?'))
        return Response.json({
          success: true,
          result: [{ script: 'acorn-ash-game-server-pr-210', class: 'World' }],
        });
      if (url.includes('api.github.com'))
        return Response.json({
          number: 210,
          state: 'closed',
          head: { repo: { full_name: options.repository } },
        });
      return new Response('export default { fetch() {} }');
    },
  });
  assert.equal(report.previews[0].workerExists, true);
});

function cloud({ reopened = false, release = true, deletionStatus = 200 } = {}) {
  let namespaces = [
    ...Array.from({ length: 80 }, () => ({
      script: 'acorn-ash-game-server-staging',
      class: 'World',
    })),
    { script: 'acorn-ash-game-server-pr-210', class: 'World' },
    { script: 'acorn-ash-game-server-pr-211', class: 'World' },
    { script: 'acorn-ash-game-server-pr-212', class: 'World' },
    { script: 'acorn-ash-game-server-pr-213', class: 'World' },
    { script: 'acorn-ash-game-server-pr-213', class: 'UnknownClass' },
  ];
  const deleted = [];
  const reads = new Map();
  const request = async (url, init) => {
    if (url.includes('/namespaces?')) return Response.json({ success: true, result: namespaces });
    if (url.includes('api.github.com')) {
      const number = Number(url.split('/').at(-1));
      reads.set(number, (reads.get(number) ?? 0) + 1);
      return Response.json({
        number,
        state: number === 212 || (reopened && reads.get(number) > 1) ? 'open' : 'closed',
        head: { repo: { full_name: options.repository } },
      });
    }
    if (init.method === 'DELETE') {
      const worker = new URL(url).pathname.split('/').at(-1);
      deleted.push(worker);
      if (release) namespaces = namespaces.filter((ns) => ns.script !== worker);
      return deletionStatus === 200
        ? Response.json({ success: true })
        : new Response(null, { status: deletionStatus });
    }
    return new Response('export default {}');
  };
  return { request, deleted, wait: async () => {} };
}
test('default cleanup is only a plan; apply is explicit, bounded and excludes open or unrecognized previews', async () => {
  const dry = cloud();
  const plan = await recoverPreviewCapacity({ ...options, ...dry });
  assert.deepEqual(dry.deleted, []);
  assert.deepEqual(plan.removed, ['acorn-ash-game-server-pr-210', 'acorn-ash-game-server-pr-211']);
  const live = cloud();
  const result = await recoverPreviewCapacity({ ...options, ...live, apply: true, maxRemovals: 1 });
  assert.deepEqual(live.deleted, ['acorn-ash-game-server-pr-210']);
  assert.equal(result.before, 85);
  assert.equal(result.after, 84);
});
test('refuses a preview reopened after planning, before any destructive request', async () => {
  const mock = cloud({ reopened: true });
  await assert.rejects(
    recoverPreviewCapacity({ ...options, ...mock, apply: true }),
    /closure changed/,
  );
  assert.deepEqual(mock.deleted, []);
});
test('stops immediately if namespace release fails or Cloudflare refuses retirement', async () => {
  const unreleased = cloud({ release: false });
  await assert.rejects(
    recoverPreviewCapacity({ ...options, ...unreleased, apply: true }),
    /namespaces remain/,
  );
  assert.equal(unreleased.deleted.length, 1);
  const refused = cloud({ deletionStatus: 403 });
  await assert.rejects(recoverPreviewCapacity({ ...options, ...refused, apply: true }), /HTTP 403/);
  assert.equal(refused.deleted.length, 1);
});
test('a missing Worker is idempotent only after namespace absence is verified', async () => {
  const mock = cloud({ deletionStatus: 404 });
  const result = await recoverPreviewCapacity({ ...options, ...mock, apply: true });
  assert.equal(result.after, 83);
  assert.equal(mock.deleted.length, 2);
});
test('validates destructive bounds and never targets another repository', async () => {
  for (const change of [
    { target: 100 },
    { maxRemovals: 100 },
    { apply: 'true' },
    { repository: 'someone/else' },
  ]) {
    let called = false;
    await assert.rejects(
      recoverPreviewCapacity({
        ...options,
        ...change,
        request: async () => {
          called = true;
          throw new Error('unexpected');
        },
      }),
    );
    assert.equal(called, false);
  }
});
test('reads all advertised pages even if Cloudflare returns fewer rows than requested', async () => {
  const pages = [];
  const report = await previewNamespaces({
    ...options,
    request: async (url) => {
      const page = Number(new URL(url).searchParams.get('page'));
      pages.push(page);
      return Response.json({
        success: true,
        result: [{ script: 'acorn-ash-game-server-staging', class: 'World' }],
        result_info: { total_pages: 2 },
      });
    },
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(report.total, 2);
});
