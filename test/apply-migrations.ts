import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

/**
 * D1 每個查詢最多 100 個綁定參數（https://developers.cloudflare.com/d1/platform/limits/），本機的 SQLite 上限高得多，
 * 超過時只有正式環境會失敗（BUG-1：inArray(筆記 id) 在筆記超過 100 則時壞掉）。
 * 測試端的 env.DB 就是 Worker 用的同一個物件，所以在這裡包一層：超過上限的查詢在測試就丟錯。
 */
const D1_MAX_BOUND_PARAMETERS = 100;
// 這個 setup 每個測試檔都會執行一次：記號放在 env.DB 本身，同一個物件只包一層
const GUARDED = Symbol.for('studyflow:d1-bound-parameter-guard');
const db = env.DB as typeof env.DB & { [GUARDED]?: true };
if (!db[GUARDED]) {
	db[GUARDED] = true;
	const prepare = env.DB.prepare.bind(env.DB);
	env.DB.prepare = (sql: string) => {
		const statement = prepare(sql);
		const bind = statement.bind.bind(statement);
		statement.bind = (...values: unknown[]) => {
			if (values.length > D1_MAX_BOUND_PARAMETERS) {
				throw new Error(`D1 每個查詢最多 ${D1_MAX_BOUND_PARAMETERS} 個參數，這個查詢有 ${values.length} 個：${sql.slice(0, 120)}`);
			}
			return bind(...values);
		};
		return statement;
	};
}
