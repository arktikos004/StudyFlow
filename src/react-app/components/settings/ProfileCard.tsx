import { useState } from 'react';
import { useUpdateProfile, useUser } from '../../lib/queries';
import { Button, Card, CardHeader, Field, Input, Select } from '../ui';

const TIMEZONES = [
	'Asia/Taipei',
	'Asia/Tokyo',
	'Asia/Hong_Kong',
	'Asia/Shanghai',
	'Asia/Singapore',
	'Europe/London',
	'America/New_York',
	'America/Los_Angeles',
	'Australia/Sydney',
];

export function ProfileCard() {
	const user = useUser();
	const update = useUpdateProfile();
	const [displayName, setDisplayName] = useState(user.displayName);
	const [timezone, setTimezone] = useState(user.timezone);
	const zones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];

	return (
		<Card>
			<CardHeader title="個人資料" />
			<form
				className="space-y-4 px-4 pb-5 sm:px-5"
				onSubmit={(e) => {
					e.preventDefault();
					update.mutate({ displayName: displayName.trim(), timezone });
				}}
			>
				<Field label="Email">{(id) => <Input id={id} value={user.email} disabled />}</Field>
				<Field label="暱稱">
					{(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />}
				</Field>
				<Field label="時區" hint="用來判斷「今天」與統計每天的學習時間">
					{(id) => (
						<Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
							{zones.map((z) => (
								<option key={z} value={z}>
									{z}
								</option>
							))}
						</Select>
					)}
				</Field>
				<div className="flex justify-end">
					<Button
						type="submit"
						variant="primary"
						loading={update.isPending}
						disabled={displayName.trim() === user.displayName && timezone === user.timezone}
					>
						儲存
					</Button>
				</div>
			</form>
		</Card>
	);
}
