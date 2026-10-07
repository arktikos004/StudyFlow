import type { ReviewMode } from '../../../lib/notes-params';
import { CramReview } from './cram';
import { DueReview } from './due';

// 複習（NOTE-2）：「今天到期」走間隔複習（呼叫 /notes/:id/review），
// 「考前衝刺」只在前端記錄這一輪的結果，不呼叫 useReviewNote，不影響複習排程。

/** 複習：「今天到期」（間隔複習）或「考前衝刺」（只在這一輪記錄，不影響排程） */
export function ReviewView({
	mode,
	subjectId,
	tag,
	onParams,
	onOpenNote,
	onNewMistake,
	onBack,
}: {
	mode: ReviewMode;
	subjectId: string | null;
	tag: string | null;
	/** 更新網址上的畫面狀態（mode、subject、tag） */
	onParams: (patch: { mode?: ReviewMode; subject?: string | null; tag?: string | null }) => void;
	onOpenNote: (id: string) => void;
	onNewMistake: () => void;
	onBack: () => void;
}) {
	const onMode = (m: ReviewMode) => onParams({ mode: m });
	return (
		<div className="max-w-2xl">
			{mode === 'cram' ? (
				<CramReview
					subjectId={subjectId}
					tag={tag}
					onScope={onParams}
					onMode={onMode}
					onOpenNote={onOpenNote}
					onNewMistake={onNewMistake}
				/>
			) : (
				<DueReview
					subjectId={subjectId}
					onSubject={(subject) => onParams({ subject })}
					onMode={onMode}
					onOpenNote={onOpenNote}
					onBack={onBack}
					onNewMistake={onNewMistake}
				/>
			)}
		</div>
	);
}
