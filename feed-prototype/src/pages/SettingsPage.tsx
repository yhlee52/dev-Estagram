import { useEffect, useState } from 'react';
import { getAuthSession } from '../api/authApi';
import type { ApiAccount } from '../api/types';
import { clearActiveApiUser } from '../auth/apiActiveUser';
import { APP_RELEASE_LABEL } from '../config/appVersion';
import { mapApiAccountToAccount } from '../data/apiFeedRepository';
import { DeactivateAccountPanel, PasswordChangePanel } from './MePage';
import PinnedMetadataKeysControl from '../components/PinnedMetadataKeysControl';
import { getMetadataKeys } from '../api/metadataApi';
import type { ApiMetadataKeyCount } from '../api/types';
import { isApiMode } from '../config/dataSource';
import EmptyState from '../components/EmptyState';

export default function SettingsPage() {
  const [account, setAccount] = useState<ApiAccount | null>(null);
  const [error, setError] = useState('');
  const [metadataKeys, setMetadataKeys] = useState<ApiMetadataKeyCount[]>([]);
  useEffect(() => {
    if (!isApiMode()) return;
    let live = true;
    void getAuthSession().then((session) => {
      if (live) setAccount(session.account);
    }).catch(() => { if (live) setError('계정 설정을 불러오지 못했습니다.'); });
    void getMetadataKeys(50).then((items) => { if (live) setMetadataKeys(items); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!isApiMode()) return <EmptyState title="API 모드에서만 사용할 수 있습니다" description="계정 설정은 API 모드에서 로그인한 뒤 사용할 수 있습니다." />;
  return <div className="space-y-5">
    <h1 className="text-xl font-bold">설정</h1>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {account ? <><PasswordChangePanel /><DeactivateAccountPanel account={mapApiAccountToAccount(account)} onDeactivated={clearActiveApiUser} />
      <section className="rounded-md border border-neutral-200 bg-white p-4"><h2 className="mb-2 text-sm font-bold">게시글 카드 표시</h2><PinnedMetadataKeysControl keySuggestions={metadataKeys} /></section>
      <details className="rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-500"><summary className="cursor-pointer font-bold">실행 정보</summary>
        <dl className="mt-2 space-y-1"><div>계정 ID: {account.id}</div><div>사용자 ID: {account.user_id}</div><div>데이터 모드: API</div><div>버전: {APP_RELEASE_LABEL}</div></dl>
      </details></> : null}
  </div>;
}
