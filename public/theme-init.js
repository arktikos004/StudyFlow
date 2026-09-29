try {
	var m = localStorage.getItem('studyflow:theme');
	var dark = m === 'dark' || (m !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {
	document.documentElement.dataset.theme = 'light';
}
