import { defineConfig } from 'drizzle-kit';

// 只用 drizzle-kit 產生 SQL migration，實際套用交給 `wrangler d1 migrations apply`
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/worker/db/schema.ts',
	out: './migrations',
});
