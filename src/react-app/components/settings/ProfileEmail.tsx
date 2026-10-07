import { Fragment } from 'react';
import { emailParts } from '../../lib/profile-format';

/**
 * 會換行的 Email：只在「@」與「.」前面斷開（<wbr>），手機上長的學校信箱不會從單字中間斷；
 * 單一片段本身就比整行還長時，外層的 overflow-wrap: anywhere 才接手。
 */
export function EmailText({ email }: { email: string }) {
	return (
		<>
			{emailParts(email).map((part, i) => (
				<Fragment key={i}>
					{i > 0 && <wbr />}
					{part}
				</Fragment>
			))}
		</>
	);
}
