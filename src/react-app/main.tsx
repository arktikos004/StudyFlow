import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './components/Layout';
import { GuestOnly, RequireAuth } from './components/RequireAuth';
import { AppError, PageError } from './components/RouteError';
import { ThemedToaster } from './components/ThemedToaster';
import { PageLoader } from './components/ui';
import { ApiError } from './lib/api';
import { ME_KEY } from './lib/queries';
import { initTheme } from './lib/theme';
import { NotFound } from './pages/NotFound';
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
const SubjectPage = lazy(() => import('./pages/Subject').then((m) => ({ default: m.SubjectPage })));
const AchievementsPage = lazy(() => import('./pages/Achievements').then((m) => ({ default: m.AchievementsPage })));

const page = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

initTheme();

// 有新版本時 Service Worker 自動更新
registerSW({ immediate: true });

// 任何請求收到 401（例如 session 過期）就視為登出，RequireAuth 會導回登入頁
const onAuthError = (error: unknown) => {
	if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(ME_KEY, null);
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

const router = createBrowserRouter([
	{
		path: '/login',
		element: <GuestOnly>{page(<LoginPage />)}</GuestOnly>,
		errorElement: <AppError />,
	},
	{
		path: '/register',
		element: <GuestOnly>{page(<RegisterPage />)}</GuestOnly>,
		errorElement: <AppError />,
	},
	{
		element: (
			<RequireAuth>
				<Layout />
			</RequireAuth>
		),
		errorElement: <AppError />,
		children: [
			{
				// 頁面出錯（程式檔下載失敗、render 例外）只換掉內容區，側欄與頁首還在
				errorElement: <PageError />,
				children: [
					{ index: true, element: page(<DashboardPage />) },
					{ path: 'calendar', element: page(<CalendarPage />) },
					{ path: 'events', element: page(<EventsPage />) },
					{ path: 'tasks', element: page(<TasksPage />) },
					{ path: 'timer', element: page(<TimerPage />) },
					{ path: 'notes', element: page(<NotesPage />) },
					{ path: 'stats', element: page(<StatsPage />) },
					{ path: 'settings', element: page(<SettingsPage />) },
					{ path: 'subjects/:id', element: page(<SubjectPage />) },
					{ path: 'achievements', element: page(<AchievementsPage />) },
					{ path: '*', element: <NotFound /> },
				],
			},
		],
	},
]);

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<ThemedToaster />
		</QueryClientProvider>
	</StrictMode>,
);
