import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { createDb } from './lib/db';
import { achievementRoutes } from './routes/achievements';
import { attachmentRoutes } from './routes/attachments';
import { authRoutes } from './routes/auth';
import { avatarRoutes } from './routes/avatar';
import { dashboardRoutes } from './routes/dashboard';
import { eventRoutes } from './routes/events';
import { exportRoutes } from './routes/export';
import { noteRoutes } from './routes/notes';
import { profileRoutes } from './routes/profile';
import { searchRoutes } from './routes/search';
import { statsRoutes } from './routes/stats';
import { studySessionRoutes } from './routes/study-sessions';
import { subjectRoutes } from './routes/subjects';
import { summaryRoutes } from './routes/summary';
import { taskRoutes } from './routes/tasks';
import type { AppEnv } from './types';

// 驗證錯誤的預設訊息用 zh-TW：schema 沒有自己寫訊息的欄位（例如列舉、ID 格式），原本會回 Zod 的英文訊息
z.config(z.locales.zhTW());

/** 每個請求一個資料庫連線物件，放在 c.var.db */
const injectDb = createMiddleware<AppEnv>(async (c, next) => {
	c.set('db', createDb(c.env.DB));
	await next();
});

/** API 的回應預設不快取；自己設了 Cache-Control 的（照片、頭像）不動 */
const noStoreByDefault = createMiddleware<AppEnv>(async (c, next) => {
	await next();
	if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

const app = new Hono<AppEnv>();

app.use('/api/*', secureHeaders());
// 擋掉其他網站用表單偷偷送出的請求（檢查 Origin）；JSON 請求本身就受 CORS 保護
app.use('/api/*', csrf());
app.use('/api/*', injectDb);
app.use('/api/*', noStoreByDefault);

app
	.get('/api/health', (c) => c.json({ ok: true }))
	.route('/api/auth', authRoutes)
	.route('/api/auth/avatar', avatarRoutes)
	.route('/api/subjects', subjectRoutes)
	.route('/api/events', eventRoutes)
	.route('/api/tasks', taskRoutes)
	.route('/api/study-sessions', studySessionRoutes)
	.route('/api/notes', noteRoutes)
	.route('/api/attachments', attachmentRoutes)
	.route('/api/stats', statsRoutes)
	.route('/api/dashboard', dashboardRoutes)
	.route('/api/summary', summaryRoutes)
	.route('/api/export', exportRoutes)
	.route('/api/search', searchRoutes)
	.route('/api/achievements', achievementRoutes)
	.route('/api/profile', profileRoutes);

app.notFound((c) => c.json({ error: '找不到此 API' }, 404));

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status);
	}
	console.error(err);
	return c.json({ error: '伺服器發生錯誤，請稍後再試' }, 500);
});

export default app;
