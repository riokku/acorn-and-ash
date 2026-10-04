import { defineConfig } from 'drizzle-kit';

/**
 * Only used to write the SQL migration from `src/accounts/schema.ts`. Wrangler
 * applies the files in `migrations/` to D1; Drizzle never touches a database.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/accounts/schema.ts',
  out: './migrations',
});
