import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cloudflareApi, ensureDatabase, ensureSecret } from '../prepare-accounts.mjs';

/** A pretend Cloudflare that remembers what it was asked and answers from a script. */
function pretendCloudflare(answers) {
  const asked = [];
  const send = async (url, init) => {
    const path = url.replace('https://api.cloudflare.com/client/v4/accounts/acct', '');
    asked.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined });
    const answer = answers.shift();
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  };
  return { api: cloudflareApi({ token: 't', accountId: 'acct', send }), asked };
}

describe('the accounts database', () => {
  it('is reused when it already exists', async () => {
    const { api, asked } = pretendCloudflare([
      {
        body: { success: true, result: [{ uuid: 'abc-123', name: 'acorn-ash-accounts-staging' }] },
      },
    ]);

    assert.equal(await ensureDatabase(api, 'acorn-ash-accounts-staging'), 'abc-123');
    assert.equal(asked.length, 1);
  });

  it('is created when there is none', async () => {
    const { api, asked } = pretendCloudflare([
      { body: { success: true, result: [] } },
      { body: { success: true, result: { uuid: 'new-id', name: 'acorn-ash-accounts-staging' } } },
    ]);

    assert.equal(await ensureDatabase(api, 'acorn-ash-accounts-staging'), 'new-id');
    assert.deepEqual(asked[1], {
      method: 'POST',
      path: '/d1/database',
      body: { name: 'acorn-ash-accounts-staging' },
    });
  });

  it('is not mistaken for another database whose name merely contains it', async () => {
    // The API's name filter matches part of a name: staging must not pick up
    // "...-staging-old", or a deploy would run against the wrong database.
    const { api } = pretendCloudflare([
      {
        body: {
          success: true,
          result: [{ uuid: 'wrong', name: 'acorn-ash-accounts-staging-old' }],
        },
      },
      { body: { success: true, result: { uuid: 'right' } } },
    ]);

    assert.equal(await ensureDatabase(api, 'acorn-ash-accounts-staging'), 'right');
  });

  it('explains what permission is missing when the token is refused', async () => {
    const { api } = pretendCloudflare([
      { status: 403, body: { success: false, errors: [{ message: 'Authentication error' }] } },
    ]);

    await assert.rejects(ensureDatabase(api, 'x'), /D1: Edit/);
  });
});

describe('the session secret', () => {
  it('is made for a Worker that has none', async () => {
    const { api, asked } = pretendCloudflare([
      { body: { success: true, result: [] } },
      { body: { success: true, result: {} } },
    ]);

    const made = await ensureSecret(
      api,
      'acorn-ash-web-staging',
      'BETTER_AUTH_SECRET',
      () => 'value',
    );

    assert.equal(made, true);
    assert.deepEqual(asked[1], {
      method: 'PUT',
      path: '/workers/scripts/acorn-ash-web-staging/secrets',
      body: { name: 'BETTER_AUTH_SECRET', text: 'value', type: 'secret_text' },
    });
  });

  it('is left alone when it already exists, because changing it signs everyone out', async () => {
    const { api, asked } = pretendCloudflare([
      { body: { success: true, result: [{ name: 'BETTER_AUTH_SECRET', type: 'secret_text' }] } },
    ]);

    const made = await ensureSecret(api, 'acorn-ash-web-staging', 'BETTER_AUTH_SECRET');

    assert.equal(made, false);
    assert.equal(asked.length, 1, 'only looked, never wrote');
  });

  it('is long and random by default', async () => {
    const written = [];
    const { api } = pretendCloudflare([
      { body: { success: true, result: [] } },
      { body: { success: true, result: {} } },
    ]);
    const request = api.request;
    api.request = (method, path, body) => {
      if (method === 'PUT') written.push(body.text);
      return request(method, path, body);
    };

    await ensureSecret(api, 'w', 'S');

    assert.match(written[0], /^[0-9a-f]{64}$/);
  });
});
