import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// 由 public/logo.svg 產生 PWA 所需的各尺寸圖示：npx pwa-assets-generator
export default defineConfig({
	headLinkOptions: { preset: '2023' },
	preset: {
		...minimal2023Preset,
		maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#2d53ca' } },
		apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#2d53ca' } },
	},
	images: ['public/logo.svg'],
});
