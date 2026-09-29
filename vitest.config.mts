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
			// 只跑 test/ 裡的測試；.claude/worktrees/ 內其他 agent 的工作副本不列入
			include: ['test/**/*.spec.ts'],
			setupFiles: ['./test/apply-migrations.ts'],
		},
	};
});
