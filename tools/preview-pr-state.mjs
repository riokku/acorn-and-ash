import { pathToFileURL } from 'node:url';

/** Read-only gate: only this repository's closed PR can retire its named preview. */
export async function previewPrState({
  repository,
  number,
  githubToken,
  accountId,
  cloudflareToken,
  worker,
  request = fetch,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error('Invalid preview pull request identity');
  }
  const expectedWorker = `acorn-ash-game-server-pr-${number}`;
  if (worker !== expectedWorker) throw new Error('Unexpected preview Worker name');
  if (!githubToken) throw new Error('Missing GitHub token for preview lifecycle verification');
  const ask = async (url, init) => {
    try {
      return await request(url, { ...init, signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error('Cannot reach preview lifecycle service');
    }
  };
  const prResponse = await ask(`https://api.github.com/repos/${repository}/pulls/${number}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
  });
  if (!prResponse.ok) throw new Error(`Cannot verify preview PR state (HTTP ${prResponse.status})`);
  const pr = await prResponse.json();
  if (pr.number !== number || pr.head?.repo?.full_name !== repository) {
    throw new Error('Preview PR does not belong to this repository');
  }
  if (pr.state === 'open') return { open: true, remove: false };
  if (pr.state !== 'closed') throw new Error('Unrecognized preview PR state');
  if (!accountId || !cloudflareToken)
    throw new Error('Missing Cloudflare credentials for closed-preview verification');
  const workerResponse = await ask(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${worker}`,
    { headers: { Authorization: `Bearer ${cloudflareToken}` } },
  );
  await workerResponse.body?.cancel();
  if (workerResponse.status === 404) return { open: false, remove: false };
  if (workerResponse.ok) return { open: false, remove: true };
  throw new Error(`Cannot verify closed preview Worker (HTTP ${workerResponse.status})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  previewPrState({
    repository: process.env.GITHUB_REPOSITORY,
    number: Number(process.env.PR_NUMBER),
    githubToken: process.env.GH_TOKEN,
    accountId: process.env.CF_ACCOUNT_ID,
    cloudflareToken: process.env.CF_API_TOKEN,
    worker: process.env.PR_GAME_SERVER,
  })
    .then(({ open, remove }) => {
      console.log(`open=${open}\nremove=${remove}`);
      console.error(
        open
          ? 'Pull request is open; keep its preview.'
          : remove
            ? 'Closed pull request has a late preview to remove.'
            : 'Closed pull request has no preview server.',
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
