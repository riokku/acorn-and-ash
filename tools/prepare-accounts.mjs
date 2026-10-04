#!/usr/bin/env node
/**
 * Gets Cloudflare ready for player accounts, so nobody has to do it by hand.
 * Run by the deploy workflows (see decision 0086):
 *
 *   node tools/prepare-accounts.mjs database <name>
 *       Makes sure a D1 database with this name exists and prints its id.
 *
 *   node tools/prepare-accounts.mjs secret <worker> <SECRET_NAME>
 *       Makes sure the deployed Worker has this secret, giving it a long random
 *       one if it has none. A secret that already exists is never touched:
 *       changing the session secret would sign every player out.
 *
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment. The
 * token needs "D1: Edit" and "Workers Scripts: Edit" permission.
 */
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';

/** A thin client for the Cloudflare API that turns every failure into a plain message. */
export function cloudflareApi({ token, accountId, send = fetch }) {
  return {
    accountId,
    async request(method, path, body) {
      const response = await send(`${API}/accounts/${accountId}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        const reason = payload?.errors?.map((error) => error.message).join('; ') ?? 'no details';
        const hint =
          response.status === 401 || response.status === 403
            ? ' The API token probably lacks permission: it needs "D1: Edit" and "Workers Scripts: Edit".'
            : '';
        throw new Error(
          `Cloudflare answered ${response.status} to ${method} ${path}: ${reason}.${hint}`,
        );
      }
      return payload?.result;
    },
  };
}

/** The id of the database with exactly this name, creating it if there is none. */
export async function ensureDatabase(api, name) {
  // The API's name filter matches part of a name, so check for the whole thing.
  const found = await api.request('GET', `/d1/database?name=${encodeURIComponent(name)}`);
  const existing = (found ?? []).find((database) => database.name === name);
  if (existing) return existing.uuid;

  const created = await api.request('POST', '/d1/database', { name });
  return created.uuid;
}

/** Whether a secret had to be made. An existing one is left exactly as it is. */
export async function ensureSecret(
  api,
  worker,
  name,
  makeValue = () => randomBytes(32).toString('hex'),
) {
  const have = await api.request('GET', `/workers/scripts/${encodeURIComponent(worker)}/secrets`);
  if ((have ?? []).some((secret) => secret.name === name)) return false;

  await api.request('PUT', `/workers/scripts/${encodeURIComponent(worker)}/secrets`, {
    name,
    text: makeValue(),
    type: 'secret_text',
  });
  return true;
}

async function main(args, environment) {
  const [command, ...rest] = args;
  const token = environment.CLOUDFLARE_API_TOKEN;
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set.');
  }
  const api = cloudflareApi({ token, accountId });

  if (command === 'database' && rest.length === 1) {
    process.stdout.write(`${await ensureDatabase(api, rest[0])}\n`);
  } else if (command === 'secret' && rest.length === 2) {
    const made = await ensureSecret(api, rest[0], rest[1]);
    console.error(
      made ? `Gave ${rest[0]} a new ${rest[1]}.` : `${rest[0]} already has ${rest[1]}.`,
    );
  } else {
    throw new Error('Usage: prepare-accounts.mjs database <name> | secret <worker> <SECRET_NAME>');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
