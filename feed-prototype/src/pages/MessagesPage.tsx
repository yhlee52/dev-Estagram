import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getUserFollows } from '../api/followsApi';
import {
  createRoom, getRoom, getRooms, imageUrl, inviteMembers, leaveRoom, openDirectRoom,
  sendRoomImage, sendRoomMessage, type DirectMessage, type MessageRoom, type RoomDetail,
} from '../api/messagesApi';
import type { ApiAccount } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { formatDateTime } from '../utils/format';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function roomTitle(room: MessageRoom, userId: string): string {
  return room.name || room.members.filter((member) => member.user_id !== userId)
    .map((member) => member.display_name).join(', ') || '나만 남은 대화방';
}

function recentText(message: DirectMessage | null): string {
  if (!message) return '아직 메시지가 없습니다.';
  return message.image_url ? `사진${message.text ? ` · ${message.text}` : ''}` : message.text;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}

export default function MessagesPage() {
  const { accountId, roomId } = useParams();
  const navigate = useNavigate();
  const { activeApiUserId } = useActiveApiUser();
  const [rooms, setRooms] = useState<MessageRoom[]>([]);
  const [following, setFollowing] = useState<ApiAccount[]>([]);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [draftState, setDraftState] = useState({ key: '', text: '' });
  const [imageState, setImageState] = useState<{ key: string; file: File | null }>({ key: '', file: null });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const displayedRoom = useRef<string | null>(null);
  const isComposing = useRef(false);
  const directOpening = useRef<string | null>(null);

  const refreshRooms = async () => setRooms(await getRooms());

  useEffect(() => {
    if (!activeApiUserId) return;
    let live = true;
    Promise.all([getRooms(), getUserFollows(activeApiUserId)]).then(([loadedRooms, follows]) => {
      if (!live) return;
      setRooms(loadedRooms);
      setFollowing(follows.follows.map((entry) => entry.account)
        .filter((account) => !account.deactivated_at));
      setListLoading(false);
    }).catch((loadError) => {
      if (live) { setError(errorText(loadError)); setListLoading(false); }
    });
    return () => { live = false; };
  }, [activeApiUserId]);

  useEffect(() => {
    if (!accountId || !activeApiUserId || directOpening.current === accountId) return;
    directOpening.current = accountId;
    void openDirectRoom(accountId).then((room) => {
      setRooms((previous) => [room, ...previous.filter((item) => item.id !== room.id)]);
      navigate(`/messages/rooms/${room.id}`, { replace: true });
    }).catch((openError) => {
      setError(errorText(openError));
      directOpening.current = null;
    });
  }, [accountId, activeApiUserId, navigate]);

  useEffect(() => {
    if (!roomId || !activeApiUserId) return;
    let live = true;
    void getRoom(roomId).then((loaded) => {
      if (live) { setDetail(loaded); setError(''); }
    }).catch((loadError) => {
      if (live) { setDetail(null); setError(errorText(loadError)); }
    });
    return () => { live = false; };
  }, [roomId, activeApiUserId]);

  useEffect(() => {
    if (!activeApiUserId) return;
    let live = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void Promise.all([getRooms(), getUserFollows(activeApiUserId)]).then(([loadedRooms, follows]) => {
        if (!live) return;
        setRooms(loadedRooms);
        setFollowing(follows.follows.map((entry) => entry.account)
          .filter((account) => !account.deactivated_at));
      }).catch(() => {});
      if (roomId) void getRoom(roomId).then((loaded) => {
        if (live) setDetail(loaded);
      }).catch(() => {});
    }, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeApiUserId, roomId]);

  const current = detail?.room.id === roomId ? detail : null;
  const draft = draftState.key === roomId ? draftState.text : '';
  const imageFile = imageState.key === roomId ? imageState.file : null;
  const accountChoices = following.filter((account) =>
    `${account.display_name} ${account.handle}`.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase()));
  const recipients = current?.room.members.filter((member) => member.user_id !== activeApiUserId && !member.deactivated_at) ?? [];
  const canSend = recipients.length > 0;
  const inviteChoices = following.filter((account) => !current?.room.members.some((member) => member.id === account.id));

  useEffect(() => {
    const list = messageList.current;
    if (!list || !current) return;
    const roomChanged = displayedRoom.current !== current.room.id;
    if (roomChanged || list.scrollHeight - list.scrollTop - list.clientHeight < 240) {
      list.scrollTop = list.scrollHeight;
    }
    displayedRoom.current = current.room.id;
  }, [current]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [lightboxUrl]);

  const toggleSelection = (id: string) => setSelectedIds((previous) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);

  const startNew = () => {
    setSelectedIds([]);
    setAccountSearch('');
    setNewName('');
    setInviteOpen(false);
    setNewOpen(true);
    setError('');
  };

  const submitNew = async () => {
    if (!selectedIds.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const room = selectedIds.length === 1
        ? await openDirectRoom(selectedIds[0])
        : await createRoom(selectedIds, newName);
      setNewOpen(false);
      setSelectedIds([]);
      await refreshRooms();
      navigate(`/messages/rooms/${room.id}`);
    } catch (createError) {
      setError(errorText(createError));
    } finally {
      setBusy(false);
    }
  };

  const submitInvite = async () => {
    if (!roomId || !selectedIds.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const room = await inviteMembers(roomId, selectedIds);
      setDetail((previous) => previous?.room.id === roomId ? { ...previous, room } : previous);
      setInviteOpen(false);
      setSelectedIds([]);
      await refreshRooms();
    } catch (inviteError) {
      setError(errorText(inviteError));
    } finally {
      setBusy(false);
    }
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComposing.current || !roomId || !canSend || busy) return;
    const text = draft.trim();
    if (!text && !imageFile) return;
    setBusy(true);
    setError('');
    try {
      const message = imageFile
        ? await sendRoomImage(roomId, imageFile, text)
        : await sendRoomMessage(roomId, text);
      setDetail((previous) => previous?.room.id === roomId
        ? { ...previous, messages: [...previous.messages, message],
            room: { ...previous.room, last_message: message } } : previous);
      setDraftState((previous) => previous.key === roomId ? { key: roomId, text: '' } : previous);
      setImageState((previous) => previous.key === roomId ? { key: roomId, file: null } : previous);
      if (fileInput.current) fileInput.current.value = '';
      void refreshRooms().catch(() => {});
    } catch (sendError) {
      setError(errorText(sendError));
    } finally {
      setBusy(false);
    }
  };

  const selectImage = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('JPEG, PNG, GIF, WebP 이미지만 보낼 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('이미지는 5MB 이하여야 합니다.');
      return;
    }
    setError('');
    setImageState({ key: roomId ?? '', file });
  };

  const exitRoom = async () => {
    if (!roomId || busy) return;
    setBusy(true);
    setError('');
    try {
      await leaveRoom(roomId);
      setDetail(null);
      setRooms((previous) => previous.filter((room) => room.id !== roomId));
      navigate('/messages');
    } catch (leaveError) {
      setError(errorText(leaveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-neutral-950">메시지</h1>
          <p className="mt-1 text-sm text-neutral-500">새 대화와 초대는 팔로우한 계정과 시작합니다. 참여 중인 방에서는 팔로우 여부와 관계없이 메시지를 보낼 수 있습니다.</p>
        </div>
        <button type="button" onClick={startNew} className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white">새 대화</button>
      </header>

      {newOpen ? (
        <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm" aria-label="새 대화 만들기">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">새 대화 만들기</h2>
            <button type="button" onClick={() => setNewOpen(false)} className="text-sm text-neutral-500">닫기</button>
          </div>
          <p className="mt-1 text-sm text-neutral-500">팔로우한 계정 중 한 명을 고르면 1:1 대화, 두 명 이상 고르면 그룹 대화방이 됩니다.</p>
          <input aria-label="대화 상대 검색" placeholder="이름 또는 계정 검색" value={accountSearch}
            onChange={(event) => setAccountSearch(event.target.value)}
            className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" />
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {accountChoices.length === 0 ? <p className="text-sm text-neutral-500">선택할 수 있는 팔로우 계정이 없습니다.</p> : null}
            {accountChoices.map((account) => (
              <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-neutral-50">
                <input type="checkbox" checked={selectedIds.includes(account.id)} onChange={() => toggleSelection(account.id)} />
                <span className="text-sm">{account.display_name} <span className="text-neutral-500">@{account.handle}</span></span>
              </label>
            ))}
          </div>
          {selectedIds.length > 1 ? <input aria-label="대화방 이름" placeholder="대화방 이름 (선택)" value={newName}
            onChange={(event) => setNewName(event.target.value)} maxLength={100}
            className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" /> : null}
          <button type="button" disabled={busy || !selectedIds.length} onClick={() => void submitNew()}
            className="mt-3 rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">대화 시작</button>
        </section>
      ) : null}

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="max-h-[38rem] overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 shadow-sm" aria-label="대화방 목록">
          {listLoading ? <p className="p-2 text-sm text-neutral-500">대화방을 불러오는 중...</p> : null}
          {!listLoading && rooms.length === 0 ? <p className="p-2 text-sm text-neutral-500">대화방이 없습니다. 새 대화를 시작해 보세요.</p> : null}
          {rooms.map((room) => (
            <button key={room.id} type="button" onClick={() => { setInviteOpen(false); setNewOpen(false); navigate(`/messages/rooms/${room.id}`); }}
              className={`mb-1 w-full rounded-md p-2 text-left hover:bg-neutral-100 ${roomId === room.id ? 'bg-neutral-100' : ''}`}>
              <span className="block truncate text-sm font-bold text-neutral-900">{roomTitle(room, activeApiUserId ?? '')}</span>
              <span className="block text-xs text-neutral-500">{room.kind === 'group' ? `${room.members.length}명 참여` : '1:1 대화'}</span>
              <span className="mt-1 block truncate text-xs text-neutral-500">{recentText(room.last_message)}</span>
            </button>
          ))}
        </aside>

        <section className="flex min-h-96 min-w-0 flex-col rounded-md border border-neutral-200 bg-white p-4 shadow-sm" aria-label="메시지 대화">
          {roomId && !current ? <p className="text-sm text-neutral-500">대화방을 불러오는 중...</p> : null}
          {current ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-neutral-950">{roomTitle(current.room, activeApiUserId ?? '')}</h2>
                  <p className="text-xs text-neutral-500">{current.room.members.length}명 참여 · {current.room.members.map((member) => member.display_name).join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setSelectedIds([]); setInviteOpen((value) => !value); }}
                    className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-bold">초대</button>
                  <button type="button" disabled={busy} onClick={() => void exitRoom()}
                    className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-red-700 disabled:opacity-50">나가기</button>
                </div>
              </div>

              {inviteOpen ? (
                <div className="border-b border-neutral-200 py-3">
                  <p className="text-sm font-bold">팔로우한 계정 초대</p>
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {inviteChoices.length === 0 ? <p className="text-sm text-neutral-500">초대할 수 있는 계정이 없습니다.</p> : null}
                    {inviteChoices.map((account) => (
                      <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-neutral-50">
                        <input type="checkbox" checked={selectedIds.includes(account.id)} onChange={() => toggleSelection(account.id)} />
                        <span className="text-sm">{account.display_name} <span className="text-neutral-500">@{account.handle}</span></span>
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={busy || !selectedIds.length} onClick={() => void submitInvite()}
                    className="mt-2 rounded-md bg-neutral-950 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">초대하기</button>
                </div>
              ) : null}

              <div ref={messageList} className="max-h-[30rem] min-h-64 flex-1 space-y-3 overflow-y-auto py-4">
                {current.messages.length === 0 ? <p className="text-sm text-neutral-500">아직 메시지가 없습니다. 먼저 인사해 보세요.</p> : null}
                {current.messages.map((message) => {
                  const mine = message.sender_user_id === activeApiUserId;
                  const sender = current.room.members.find((member) => member.user_id === message.sender_user_id);
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${mine ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                        {!mine && current.room.kind === 'group' ? <p className="mb-1 text-xs font-bold opacity-70">{sender?.display_name ?? '이전 참여자'}</p> : null}
                        {message.text ? <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p> : null}
                        {message.image_url ? (
                          <button type="button" onClick={() => setLightboxUrl(imageUrl(message.image_url!))}
                            aria-label="이미지 크게 보기" className="mt-1 block overflow-hidden rounded-md">
                            <img src={imageUrl(message.image_url)} alt="대화 이미지" loading="lazy" className="max-h-36 max-w-48 object-contain" />
                          </button>
                        ) : null}
                        <time dateTime={message.created_at} className="mt-1 block text-[11px] opacity-65">{formatDateTime(message.created_at)}</time>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!canSend ? (
                <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-500">
                  다른 활성 참여자가 없어 메시지를 보낼 수 없습니다.
                </p>
              ) : (
                <form onSubmit={submitMessage} className="border-t border-neutral-200 pt-3">
                  {imageFile ? <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
                    <span className="min-w-0 truncate">첨부: {imageFile.name}</span>
                    <button type="button" onClick={() => { setImageState({ key: roomId ?? '', file: null }); if (fileInput.current) fileInput.current.value = ''; }} className="font-bold">제거</button>
                  </div> : null}
                  <div className="flex gap-2">
                    <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} onChange={(event) => selectImage(event.target.files?.[0])}
                      className="hidden" aria-label="이미지 선택" />
                    <button type="button" onClick={() => fileInput.current?.click()} className="rounded-md border border-neutral-200 px-2 text-sm" aria-label="이미지 첨부">사진</button>
                    <input aria-label="메시지 내용" value={draft} onChange={(event) => setDraftState({ key: roomId ?? '', text: event.target.value })} maxLength={2000}
                      onCompositionStart={() => { isComposing.current = true; }} onCompositionEnd={() => { isComposing.current = false; }}
                      onKeyDown={(event) => { if (event.key === 'Enter' && (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                      placeholder="메시지를 입력하세요..." className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm" />
                    <button disabled={busy || (!draft.trim() && !imageFile)} type="submit"
                      className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">보내기</button>
                  </div>
                </form>
              )}
            </>
          ) : !roomId ? <p className="text-sm text-neutral-500">대화방을 선택하거나 <Link to="/messages" onClick={startNew} className="underline">새 대화</Link>를 시작하세요.</p> : null}
        </section>
      </div>

      {lightboxUrl ? (
        <div role="dialog" aria-modal="true" aria-label="이미지 크게 보기" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" onClick={() => setLightboxUrl(null)} className="absolute right-5 top-5 rounded bg-white px-3 py-1 text-sm font-bold text-neutral-900">닫기</button>
          <img src={lightboxUrl} alt="대화 이미지 확대" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}
