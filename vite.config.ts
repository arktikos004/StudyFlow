import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

// 只忽略「這份專案根目錄」底下的 .claude/（含 agent 的 worktree），避免其他分支的檔案觸發重新整理。
// 必須用絕對路徑：worktree 本身就在 .claude/worktrees/ 底下，用 '**/.claude/**' 會連 worktree 自己的檔案都忽略。
const CLAUDE_DIR = fileURLToPath(new URL('./.claude', import.meta.url));

export default defineConfig({
	server: { watch: { ignored: [`${CLAUDE_DIR}/**`] } },
	plugins: [
		react(),
		tailwindcss(),
		cloudflare(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: false,
			includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png', 'theme-init.js'],
			manifest: {
				name: 'StudyFlow 學習管理',
				short_name: 'StudyFlow',
				description: '考試倒數、學習任務、番茄鐘計時、錯題複習與學習統計',
				lang: 'zh-Hant-TW',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				theme_color: '#2a78d6',
				background_color: '#f6f6f3',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{ src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				],
			},
			workbox: {
				// 快取 App 外殼，離線也能開啟；API 一律走網路，不快取個人資料
				globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
				navigateFallback: '/index.html',
				navigateFallbackDenylist: [/^\/api\//],
				cleanupOutdatedCaches: true,
			},
		}),
	],
});
