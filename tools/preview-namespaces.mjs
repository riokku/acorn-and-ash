import { pathToFileURL } from 'node:url';

const CLASSES = new Set(['World', 'ItemCatalog']);

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
    return response.json();
  };
  const namespaces = [];
  for (let page = 1; page <= 100; page++) {
    const data = await ask(
      `${cfBase}/workers/durable_objects/namespaces?page=${page}&per_page=100`,
      cloudflareToken,
    );
    if (data.success !== true || !Array.isArray(data.result))
      throw new Error('Invalid namespace inventory');
    namespaces.push(...data.result);
    if (data.result_info?.total_pages <= page || data.result.length < 100) break;
    if (page === 100) throw new Error('Namespace inventory pagination limit reached');
  }
  const groups = new Map();
  const unclassified = [];
  for (const ns of namespaces) {
    const match =
      typeof ns.script === 'string' && /^acorn-ash-game-server-pr-([1-9]\d*)$/.exec(ns.script);
    if (!match || !CLASSES.has(ns.class)) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  previewNamespaces({
    repository: process.env.GITHUB_REPOSITORY,
    githubToken: process.env.GH_TOKEN,
    accountId: process.env.CF_ACCOUNT_ID,
    cloudflareToken: process.env.CF_API_TOKEN,
  })
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
