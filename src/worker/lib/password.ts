import { fromBase64Url, toBase64Url } from './encoding';

// PBKDF2-SHA256。Workers 的 Web Crypto 最多允許 100,000 次迭代。
// 迭代次數寫在雜湊字串裡（pbkdf2_sha256$次數$salt$hash），日後調整也不會讓舊密碼失效。
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, KEY_BITS);
	return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, ITERATIONS);
	return `pbkdf2_sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, iter, saltStr, hashStr] = stored.split('$');
	if (algo !== 'pbkdf2_sha256' || !iter || !saltStr || !hashStr) return false;
	const expected = fromBase64Url(hashStr);
	const actual = await derive(password, fromBase64Url(saltStr), Number(iter));
	if (actual.byteLength !== expected.byteLength) return false;
	// 固定時間比較，避免從回應時間推測密碼
	return crypto.subtle.timingSafeEqual(actual, expected);
}

const DUMMY_HASH = `pbkdf2_sha256$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

/**
 * 登入時驗證密碼。帳號不存在（沒有雜湊可以比對）時也跑一次同樣成本的雜湊再回 false，
 * 讓「帳號不存在」和「密碼錯誤」的回應時間一致，不能用時間差探測哪些 Email 註冊過。
 */
export async function verifyLoginPassword(password: string, storedHash: string | undefined): Promise<boolean> {
	if (storedHash === undefined) {
		await verifyPassword(password, DUMMY_HASH);
		return false;
	}
	return verifyPassword(password, storedHash);
}
