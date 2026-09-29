import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
	// 在 Node 端讀取 migration SQL，交給測試環境套用到每次測試用的 D1
	const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
			}),
		],
		test: {
			setupFiles: ['./test/apply-migrations.ts'],
		},
	};
});
