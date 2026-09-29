import type { DB } from './lib/db';
import type { User } from './db/schema';

export type AppEnv = {
	Bindings: Env;
	Variables: {
		db: DB;
		user: User;
		sessionId: string;
	};
};
