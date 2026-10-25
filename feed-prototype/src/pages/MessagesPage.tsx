import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getAccounts } from '../api/accountsApi';
import { getConversations, getThread, sendMessage, type Conversation, type DirectMessage } from '../api/messagesApi';
import type { ApiAccount } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { formatDateTime } from '../utils/format';

export default function MessagesPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { activeApiUserId } = useActiveApiUser();
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [thread, setThread] = useState<{ key: string; items: DirectMessage[] } | null>(null);
  const [draftState, setDraftState] = useState({ key: '', text: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const isComposing = useRef(false);
  const threadKey = `${activeApiUserId}:${accountId ?? ''}`;
  const loading = Boolean(accountId && thread?.key !== threadKey);
  const messages = thread?.key === threadKey ? thread.items : [];
  const draft = draftState.key === threadKey ? draftState.text : '';

  useEffect(() => {
    if (!activeApiUserId) return;
    let live = true;
    Promise.all([getAccounts(), getConversations()]).then(([allAccounts, threads]) => {
      if (!live) return;
      setAccounts(allAccounts.filter((account) => account.user_id !== activeApiUserId));
      setConversations(threads);
    }).catch(() => { if (live) setError('대화 목록을 불러오지 못했습니다.'); });
    return () => { live = false; };
  }, [activeApiUserId]);

  useEffect(() => {
    if (!accountId || !activeApiUserId) return;
    let live = true;
    void getThread(accountId).then((items) => {
      if (live) { setThread({ key: threadKey, items }); setError(''); }
    }).catch(() => {
      if (live) { setThread({ key: threadKey, items: [] }); setError('이 대화를 불러오지 못했습니다.'); }
    });
    return () => { live = false; };
  }, [accountId, activeApiUserId, threadKey]);

  const peer = accounts.find((account) => account.id === accountId)
    ?? conversations.find((item) => item.account.id === accountId)?.account;
  const accountChoices = new Map(accounts.map((account) => [account.id, account]));
  for (const conversation of conversations) {
    accountChoices.set(conversation.account.id, conversation.account);
  }
  const orderedAccounts = [...accountChoices.values()].sort((a, b) => {
    const aIndex = conversations.findIndex((item) => item.account.id === a.id);
    const bIndex = conversations.findIndex((item) => item.account.id === b.id);
    if (aIndex === -1 && bIndex === -1) return a.handle.localeCompare(b.handle);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComposing.current) return;
    const text = draft.trim();
    if (!accountId || !text || sending) return;
    setSending(true);
    setError('');
    try {
      const created = await sendMessage(accountId, text);
      setThread((previous) => previous?.key === threadKey
        ? { key: threadKey, items: [...previous.items, created] }
        : previous);
      setDraftState((previous) => previous.key === threadKey ? { key: threadKey, text: '' } : previous);
      void getConversations().then(setConversations).catch(() => {});
    } catch {
      setError('메시지를 보내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-neutral-950">메시지</h1>
        <p className="mt-1 text-sm text-neutral-500">대화할 계정을 선택하세요.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="max-h-[36rem] space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 shadow-sm" aria-label="대화 및 계정 목록">
          {orderedAccounts.length === 0 ? <p className="p-2 text-sm text-neutral-500">대화할 계정이 없습니다.</p> : null}
          {orderedAccounts.map((account) => {
            const recent = conversations.find((item) => item.account.id === account.id);
            return (
              <button key={account.id} type="button" onClick={() => navigate(`/messages/${account.id}`)}
                className={`w-full rounded-md p-2 text-left hover:bg-neutral-100 ${accountId === account.id ? 'bg-neutral-100' : ''}`}>
                <span className="block truncate text-sm font-bold text-neutral-900">{account.display_name}</span>
                <span className="block truncate text-xs text-neutral-500">@{account.handle}</span>
                {account.deactivated_at ? <span className="block text-xs text-neutral-400">비활성 계정</span> : null}
                {recent ? <span className="mt-1 block truncate text-xs text-neutral-500">{recent.last_message.text}</span> : null}
              </button>
            );
          })}
        </aside>
        <section className="flex min-h-96 flex-col rounded-md border border-neutral-200 bg-white p-4 shadow-sm" aria-label="메시지 대화">
          {peer ? (
            <>
              <div className="border-b border-neutral-200 pb-3">
                <Link className="font-bold text-neutral-950 hover:underline" to={`/accounts/${peer.id}`}>{peer.display_name}</Link>
                <p className="text-xs text-neutral-500">@{peer.handle}</p>
              </div>
              <div className="flex-1 space-y-3 py-4">
                {loading ? <p className="text-sm text-neutral-500">메시지를 불러오는 중...</p> : null}
                {!loading && messages.length === 0 ? <p className="text-sm text-neutral-500">아직 메시지가 없습니다. 먼저 인사해 보세요.</p> : null}
                {!loading && messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_user_id === activeApiUserId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${message.sender_user_id === activeApiUserId ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                      <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                      <time dateTime={message.created_at} className="mt-1 block text-[11px] opacity-65">{formatDateTime(message.created_at)}</time>
                    </div>
                  </div>
                ))}
              </div>
              {error && !loading ? <p role="alert" className="mb-2 text-sm text-red-700">{error}</p> : null}
              {peer.deactivated_at ? (
                <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-500">비활성 계정입니다. 이전 메시지는 계속 볼 수 있습니다.</p>
              ) : (
                <form onSubmit={submit} className="flex gap-2 border-t border-neutral-200 pt-3">
                  <input aria-label="메시지 내용" value={draft} onChange={(event) => setDraftState({ key: threadKey, text: event.target.value })} maxLength={2000}
                    onCompositionStart={() => { isComposing.current = true; }}
                    onCompositionEnd={() => { isComposing.current = false; }}
                    onKeyDown={(event) => { if (event.key === 'Enter' && (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                    placeholder="메시지를 입력하세요..." className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm" />
                  <button disabled={sending || !draft.trim() || loading} type="submit"
                    className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">보내기</button>
                </form>
              )}
            </>
          ) : <p className="text-sm text-neutral-500">대화를 보려면 계정을 선택하세요.</p>}
        </section>
      </div>
    </div>
  );
}
