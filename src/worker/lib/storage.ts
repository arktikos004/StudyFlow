/**
 * 刪掉已經沒有資料列引用的 R2 檔案。一律在資料庫改好之後才呼叫：
 * 刪除失敗只會留下沒人引用的檔案，記下來但不影響回應（反過來先刪檔案，資料庫失敗時會留下指向不存在檔案的資料列）。
 */
export async function deleteObjectsQuietly(bucket: R2Bucket, keys: readonly string[]) {
	if (keys.length === 0) return;
	try {
		await bucket.delete([...keys]);
	} catch (e) {
		console.error('刪除 R2 檔案失敗', keys, e);
	}
}
