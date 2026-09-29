import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './components/Layout';
import { GuestOnly, RequireAuth } from './components/RequireAuth';
import { ApiError } from './lib/api';
import { initTheme, useIsDark } from './lib/theme';
import { PageLoader } from './components/ui';
// 數字字型 Archivo（自架，CSP 為 font-src 'self'）：standard = 字重 + 字寬兩個軸
import '@fontsource-variable/archivo/standard.css';
import './index.css';

// 各頁面分開打包，進到該頁才下載（圖表函式庫只有總覽與統計頁會載入）
const LoginPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const EventsPage = lazy(() => import('./pages/Events').then((m) => ({ default: m.EventsPage })));
const TasksPage = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.TasksPage })));
const TimerPage = lazy(() => import('./pages/Timer').then((m) => ({ default: m.TimerPage })));
const NotesPage = lazy(() => import('./pages/Notes').then((m) => ({ default: m.NotesPage })));
const StatsPage = lazy(() => import('./pages/Stats').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));

const page = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

initTheme();

// 有新版本時 Service Worker 自動更新
registerSW({ immediate: true });

// 任何請求收到 401（例如 session 過期）就視為登出，RequireAuth 會導回登入頁
const onAuthError = (error: unknown) => {
	if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(['me'], null);
};
const queryClient = new QueryClient({
	queryCache: new QueryCache({ onError: onAuthError }),
	mutationCache: new MutationCache({ onError: onAuthError }),
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
		},
	},
});

function NotFound() {
	return (
		<div className="py-16 text-center">
			<p className="text-5xl font-bold text-ink-3">404</p>
			<p className="mt-3 text-ink-2">找不到這個頁面</p>
			<Link to="/" className="mt-4 inline-block text-accent-ink hover:underline">
				回到總覽
			</Link>
		</div>
	);
}

const router = createBrowserRouter([
	{
		path: '/login',
		element: <GuestOnly>{page(<LoginPage />)}</GuestOnly>,
	},
	{
		path: '/register',
		element: <GuestOnly>{page(<RegisterPage />)}</GuestOnly>,
	},
	{
		element: (
			<RequireAuth>
				<Layout />
			</RequireAuth>
		),
		children: [
			{ index: true, element: page(<DashboardPage />) },
			{ path: 'calendar', element: page(<CalendarPage />) },
			{ path: 'events', element: page(<EventsPage />) },
			{ path: 'tasks', element: page(<TasksPage />) },
			{ path: 'timer', element: page(<TimerPage />) },
			{ path: 'notes', element: page(<NotesPage />) },
			{ path: 'stats', element: page(<StatsPage />) },
			{ path: 'settings', element: page(<SettingsPage />) },
			{ path: '*', element: <NotFound /> },
		],
	},
]);

function ThemedToaster() {
	const dark = useIsDark();
	return <Toaster position="top-center" theme={dark ? 'dark' : 'light'} richColors closeButton />;
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<ThemedToaster />
		</QueryClientProvider>
	</StrictMode>,
);
