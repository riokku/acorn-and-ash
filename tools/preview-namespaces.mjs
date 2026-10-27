import { pathToFileURL } from 'node:url';

const CLASSES = new Set(['World', 'ItemCatalog']);

function namespaceClient({ accountId, cloudflareToken, request }) {
  const cfBase = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}`;
  const ask = async (url, token, allowMissing = false) => {
    let response;
    try {
      response = await request(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('Cannot reach preview inventory service');
    }
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Cannot read preview inventory (HTTP ${response.status})`);
    if (allowMissing) {
      await response.body?.cancel();
      return true;
    }
    return response.json();
  };
  const list = async () => {
    const namespaces = [];
    for (let page = 1; page <= 100; page++) {
      const data = await ask(
        `${cfBase}/workers/durable_objects/namespaces?page=${page}&per_page=100`,
        cloudflareToken,
      );
      if (data.success !== true || !Array.isArray(data.result))
        throw new Error('Invalid namespace inventory');
      namespaces.push(...data.result);
      const pages = data.result_info?.total_pages;
      if (Number.isSafeInteger(pages) ? page >= pages : data.result.length < 100) break;
      if (page === 100) throw new Error('Namespace inventory pagination limit reached');
    }
    return namespaces;
  };
  return { cfBase, ask, list };
}

/** Read-only inventory. A name alone is never authorization to retire a preview. */
export async function previewNamespaces({
  repository,
  githubToken,
  accountId,
  cloudflareToken,
  request = fetch,
}) {
  if (repository !== 'riokku/acorn-and-ash') throw new Error('Unexpected preview repository');
  if (!githubToken || !accountId || !cloudflareToken)
    throw new Error('Missing preview inventory credentials');
  const { cfBase, ask, list } = namespaceClient({ accountId, cloudflareToken, request });
  const namespaces = await list();
  const groups = new Map();
  const unclassified = [];
  for (const ns of namespaces) {
    const match =
      typeof ns.script === 'string' && /^acorn-ash-game-server-pr-([1-9]\d*)$/.exec(ns.script);
    if (
      !match ||
      namespaces.some((other) => other.script === ns.script && !CLASSES.has(other.class))
    ) {
      unclassified.push({
        script: ns.script ?? null,
        class: ns.class ?? null,
        name: ns.name ?? null,
      });
      continue;
    }
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number))
      throw new Error('Invalid preview number in namespace inventory');
    const group = groups.get(ns.script) ?? { worker: ns.script, number, classes: [] };
    group.classes.push(ns.class);
    groups.set(ns.script, group);
  }
  const previews = [];
  for (const group of groups.values()) {
    const pr = await ask(
      `https://api.github.com/repos/${repository}/pulls/${group.number}`,
      githubToken,
    );
    if (
      pr.number !== group.number ||
      pr.head?.repo?.full_name !== repository ||
      !['open', 'closed'].includes(pr.state)
    )
      throw new Error('Cannot verify preview ownership and state');
    const worker =
      pr.state === 'closed'
        ? await ask(`${cfBase}/workers/scripts/${group.worker}`, cloudflareToken, true)
        : undefined;
    previews.push({
      ...group,
      state: pr.state,
      ...(pr.state === 'closed' ? { workerExists: worker !== null } : {}),
    });
  }
  return { total: namespaces.length, previews, unclassified };
}

/** Retire only verified closed-PR Workers, using the same service delete as Wrangler. */
export async function recoverPreviewCapacity(options) {
  const {
    apply = false,
    target = 80,
    maxRemovals = 20,
    request = fetch,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  if (
    typeof apply !== 'boolean' ||
    !Number.isInteger(target) ||
    target < 10 ||
    target > 98 ||
    !Number.isInteger(maxRemovals) ||
    maxRemovals < 1 ||
    maxRemovals > 20
  )
    throw new Error('Invalid preview cleanup bounds');
  const report = await previewNamespaces({ ...options, request });
  const candidates = report.previews
    .filter((p) => p.state === 'closed' && p.workerExists)
    .sort((a, b) => a.number - b.number);
  const { cfBase, ask, list } = namespaceClient({ ...options, request });
  let namespaces = await list();
  const removed = [];
  for (const candidate of candidates) {
    if (namespaces.length <= target || removed.length >= maxRemovals) break;
    if (!apply) {
      removed.push(candidate.worker);
      namespaces = namespaces.filter((ns) => ns.script !== candidate.worker);
      continue;
    }
    // Never trust a previously generated plan: recheck closure immediately before deletion.
    const pr = await ask(
      `https://api.github.com/repos/${options.repository}/pulls/${candidate.number}`,
      options.githubToken,
    );
    if (
      pr.number !== candidate.number ||
      pr.head?.repo?.full_name !== options.repository ||
      pr.state !== 'closed'
    )
      throw new Error('Preview closure changed; refusing cleanup');
    let response;
    try {
      response = await request(`${cfBase}/workers/services/${candidate.worker}?force=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${options.cloudflareToken}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('Cannot reach preview cleanup service');
    }
    if (!response.ok && response.status !== 404)
      throw new Error(`Cannot retire closed preview (HTTP ${response.status})`);
    if (response.ok) {
      const payload = await response.json();
      if (payload.success !== true) throw new Error('Cloudflare refused preview retirement');
    }
    // Stop after the first unexpected result instead of continuing a speculative bulk cleanup.
    let remaining = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      namespaces = await list();
      remaining = namespaces.filter((ns) => ns.script === candidate.worker);
      if (!remaining.length) break;
      await wait(500);
    }
    if (remaining.length) throw new Error('Retired preview namespaces remain; stopping cleanup');
    removed.push(candidate.worker);
  }
  if (apply && namespaces.length > 98)
    throw new Error(
      'Preview capacity is still exhausted; no more eligible closed previews can be retired in this run',
    );
  return {
    before: report.total,
    after: namespaces.length,
    apply,
    removed,
    remainingClosed: candidates.length - removed.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = {
    repository: process.env.GITHUB_REPOSITORY,
    githubToken: process.env.GH_TOKEN,
    accountId: process.env.CF_ACCOUNT_ID,
    cloudflareToken: process.env.CF_API_TOKEN,
  };
  const task =
    process.env.PREVIEW_CAPACITY_APPLY === '1'
      ? recoverPreviewCapacity({
          ...options,
          apply: true,
          maxRemovals: Number(process.env.PREVIEW_CLEANUP_LIMIT ?? 20),
        })
      : previewNamespaces(options);
  task
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
