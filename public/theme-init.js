// 在第一次繪製前套用深色／淺色與主題色，避免閃爍（清單需與 src/react-app/lib/theme.ts 的 ACCENTS 同步）
(function () {
	var root = document.documentElement;
	var mode = null;
	var accent = null;
	try {
		mode = localStorage.getItem('studyflow:theme');
		accent = localStorage.getItem('studyflow:accent');
	} catch (e) {
		// 讀不到 localStorage（例如無痕模式）：跟隨系統、使用預設主題色
	}
	var dark = mode === 'dark' || (mode !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
	root.dataset.theme = dark ? 'dark' : 'light';
	root.dataset.accent = ['blue', 'lake', 'green', 'grape', 'berry', 'graphite'].indexOf(accent) >= 0 ? accent : 'blue';
	var meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', dark ? '#0c0f18' : '#f7f6f2');
})();
