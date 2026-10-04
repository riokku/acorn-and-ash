import { applyD1Migrations, env } from 'cloudflare:test';

// Runs before every test file, so each one starts with the real accounts tables.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
