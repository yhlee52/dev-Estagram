import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { followAccount, getUserFollows, unfollowAccount } from '../api/followsApi';
import {
  createRoom, getRoom, getRooms, imageUrl, inviteMembers, leaveRoom, markRoomRead, openDirectRoom,
  sendRoomImage, sendRoomMessage, type DirectMessage, type MessageRoom, type RoomDetail,
} from '../api/messagesApi';
import type { ApiAccount } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import MessageAvatar from '../components/MessageAvatar';
import { API_FOLLOWS_CHANGE_EVENT } from '../hooks/useApiFollows';
import { notifyMessageUnreadChange } from '../hooks/useMessageUnread';
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

function shortTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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
  const [roomSearch, setRoomSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [profileAccount, setProfileAccount] = useState<ApiAccount | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const displayedRoom = useRef<string | null>(null);
  const isComposing = useRef(false);
  const directOpening = useRef<string | null>(null);

  const refreshRooms = async () => setRooms(await getRooms());

  const acknowledgeRoom = useCallback((loaded: RoomDetail, isLive: () => boolean) => {
    if (document.visibilityState !== 'visible' || !loaded.room.unread_count) return;
    const latest = loaded.messages.at(-1);
    if (!latest) return;
    void markRoomRead(loaded.room.id, latest.id).then((result) => {
      if (!isLive()) return;
      setDetail((previous) => previous?.room.id === loaded.room.id && previous.messages.at(-1)?.id === latest.id
        ? { ...previous, room: { ...previous.room, unread_count: result.unread_count } } : previous);
      setRooms((previous) => previous.map((room) => room.id === loaded.room.id && room.last_message?.id === latest.id
        ? { ...room, unread_count: result.unread_count } : room));
      notifyMessageUnreadChange();
    }).catch(() => {});
  }, []);

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
      if (live) { setDetail(loaded); setError(''); acknowledgeRoom(loaded, () => live); }
    }).catch((loadError) => {
      if (live) { setDetail(null); setError(errorText(loadError)); }
    });
    return () => { live = false; };
  }, [roomId, activeApiUserId, acknowledgeRoom]);

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
        if (live) { setDetail(loaded); acknowledgeRoom(loaded, () => live); }
      }).catch(() => {});
    }, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeApiUserId, roomId, acknowledgeRoom]);

  const current = detail?.room.id === roomId ? detail : null;
  const draft = draftState.key === roomId ? draftState.text : '';
  const imageFile = imageState.key === roomId ? imageState.file : null;
  const accountChoices = following.filter((account) =>
    `${account.display_name} ${account.handle}`.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase()));
  const recipients = current?.room.members.filter((member) => member.user_id !== activeApiUserId && !member.deactivated_at) ?? [];
  const otherMembers = current?.room.members.filter((member) => member.user_id !== activeApiUserId) ?? [];
  const canSend = recipients.length > 0;
  const inviteChoices = following.filter((account) => !current?.room.members.some((member) => member.id === account.id));
  const visibleRooms = rooms.filter((room) => roomTitle(room, activeApiUserId ?? '').toLocaleLowerCase()
    .includes(roomSearch.trim().toLocaleLowerCase()));
  const totalUnread = rooms.reduce((sum, room) => sum + room.unread_count, 0);

  const toggleProfileFollow = async () => {
    if (!profileAccount || !activeApiUserId || followBusy || profileAccount.deactivated_at) return;
    setFollowBusy(true);
    setError('');
    try {
      const isFollowing = following.some((account) => account.id === profileAccount.id);
      const response = isFollowing
        ? await unfollowAccount(activeApiUserId, profileAccount.id)
        : await followAccount(activeApiUserId, profileAccount.id);
      setFollowing(response.follows.map((entry) => entry.account).filter((account) => !account.deactivated_at));
      window.dispatchEvent(new Event(API_FOLLOWS_CHANGE_EVENT));
    } catch (followError) {
      setError(errorText(followError));
    } finally {
      setFollowBusy(false);
    }
  };

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

  useEffect(() => {
    if (!profileAccount) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileAccount(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [profileAccount]);

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
      notifyMessageUnreadChange();
      navigate('/messages');
    } catch (leaveError) {
      setError(errorText(leaveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-stone-200 bg-gradient-to-r from-white via-amber-50/60 to-rose-50/70 px-5 py-5 shadow-sm sm:px-7">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-rose-600">MESSENGER</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-950">메시지</h1>
          <p className="mt-1 text-sm text-stone-600">함께 나누는 대화를 한곳에서 확인하세요.</p>
        </div>
        <button type="button" onClick={startNew} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">+ 새 대화</button>
      </header>

      {newOpen ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="새 대화 만들기">
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
              <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-stone-50">
                <input type="checkbox" checked={selectedIds.includes(account.id)} onChange={() => toggleSelection(account.id)} />
                <MessageAvatar name={account.display_name} src={account.avatar_url} size="sm" />
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

      <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm" aria-label="대화방 목록">
          <div className="border-b border-stone-100 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-stone-950">대화 목록</h2>
              {totalUnread > 0 ? <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700" aria-label={`읽지 않은 메시지 ${totalUnread}개`}>{totalUnread > 99 ? '99+' : totalUnread}개 안 읽음</span> : null}
            </div>
            <input aria-label="대화방 검색" placeholder="대화방 검색" value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)}
              className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-rose-300 focus:bg-white" />
          </div>
          <div className="max-h-[38rem] space-y-1 overflow-y-auto p-2">
          {listLoading ? <p className="p-3 text-sm text-stone-500">대화방을 불러오는 중...</p> : null}
          {!listLoading && rooms.length === 0 ? <p className="p-3 text-sm text-stone-500">대화방이 없습니다. 새 대화를 시작해 보세요.</p> : null}
          {!listLoading && rooms.length > 0 && visibleRooms.length === 0 ? <p className="p-3 text-sm text-stone-500">검색 결과가 없습니다.</p> : null}
          {visibleRooms.map((room) => (
            <button key={room.id} type="button" onClick={() => { setInviteOpen(false); setNewOpen(false); navigate(`/messages/rooms/${room.id}`); }}
              aria-current={roomId === room.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-stone-50 ${roomId === room.id ? 'bg-rose-50 ring-1 ring-rose-100' : ''}`}>
              <div className="relative">
                <MessageAvatar name={roomTitle(room, activeApiUserId ?? '')} src={room.kind === 'direct' ? room.members.find((member) => member.user_id !== activeApiUserId)?.avatar_url : null} />
                {room.unread_count > 0 ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-rose-500" /> : null}
              </div>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${room.unread_count > 0 ? 'font-extrabold text-stone-950' : 'font-bold text-stone-800'}`}>{roomTitle(room, activeApiUserId ?? '')}</span>
                  {room.last_message ? <time dateTime={room.last_message.created_at} className="shrink-0 text-[11px] text-stone-400">{shortTime(room.last_message.created_at)}</time> : null}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`block truncate text-xs ${room.unread_count > 0 ? 'font-semibold text-stone-700' : 'text-stone-500'}`}>{recentText(room.last_message)}</span>
                  {room.unread_count > 0 ? <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white" aria-label={`읽지 않은 메시지 ${room.unread_count}개`}>{room.unread_count > 99 ? '99+' : room.unread_count}</span> : null}
                </span>
                {room.kind === 'group' ? <span className="mt-1 block text-[11px] text-stone-400">그룹 · {room.members.length}명</span> : null}
              </span>
            </button>
          ))}
          </div>
        </aside>

        <section className="flex min-h-[35rem] min-w-0 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm" aria-label="메시지 대화">
          {roomId && !current ? <p className="p-6 text-sm text-stone-500">대화방을 불러오는 중...</p> : null}
          {current ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-white px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  {otherMembers[0] ? <button type="button" onClick={() => setProfileAccount(otherMembers[0])} aria-label={`${otherMembers[0].display_name} 프로필 메뉴 열기`} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"><MessageAvatar name={otherMembers[0].display_name} src={otherMembers[0].avatar_url} /></button>
                    : <MessageAvatar name={roomTitle(current.room, activeApiUserId ?? '')} />}
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold text-stone-950">{roomTitle(current.room, activeApiUserId ?? '')}</h2>
                    <p className="truncate text-xs text-stone-500">{current.room.kind === 'group' ? `${current.room.members.length}명 참여 · 사진을 눌러 프로필 보기` : '사진을 눌러 프로필 보기'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {current.room.kind === 'group' && otherMembers.length > 1 ? <div className="mr-1 flex max-w-32 items-center gap-1 overflow-x-auto py-1" aria-label="대화 참여자">
                    {otherMembers.slice(1).map((member) => <button key={member.id} type="button" onClick={() => setProfileAccount(member)} aria-label={`${member.display_name} 프로필 메뉴 열기`} className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"><MessageAvatar name={member.display_name} src={member.avatar_url} size="sm" /></button>)}
                  </div> : null}
                  <button type="button" onClick={() => { setSelectedIds([]); setInviteOpen((value) => !value); }}
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50">+ 초대</button>
                  <button type="button" disabled={busy} onClick={() => void exitRoom()}
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">나가기</button>
                </div>
              </div>

              {inviteOpen ? (
                <div className="border-b border-stone-100 bg-amber-50/40 px-5 py-4">
                  <p className="text-sm font-bold">팔로우한 계정 초대</p>
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {inviteChoices.length === 0 ? <p className="text-sm text-neutral-500">초대할 수 있는 계정이 없습니다.</p> : null}
                    {inviteChoices.map((account) => (
                      <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-white">
                        <input type="checkbox" checked={selectedIds.includes(account.id)} onChange={() => toggleSelection(account.id)} />
                        <MessageAvatar name={account.display_name} src={account.avatar_url} size="sm" />
                        <span className="text-sm">{account.display_name} <span className="text-neutral-500">@{account.handle}</span></span>
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={busy || !selectedIds.length} onClick={() => void submitInvite()}
                    className="mt-2 rounded-md bg-neutral-950 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">초대하기</button>
                </div>
              ) : null}

              <div ref={messageList} className="max-h-[34rem] min-h-64 flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-stone-50 to-amber-50/40 px-3 py-5 sm:px-5">
                {current.messages.length === 0 ? <div className="mx-auto mt-16 max-w-xs text-center"><span aria-hidden="true" className="text-4xl">✉</span><p className="mt-3 text-sm font-semibold text-stone-600">아직 메시지가 없습니다.</p><p className="mt-1 text-xs text-stone-500">첫 메시지를 보내 대화를 시작해 보세요.</p></div> : null}
                {current.messages.map((message) => {
                  const mine = message.sender_user_id === activeApiUserId;
                  const sender = current.room.members.find((member) => member.user_id === message.sender_user_id);
                  return (
                    <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {!mine && sender ? <button type="button" onClick={() => setProfileAccount(sender)} aria-label={`${sender.display_name} 프로필 메뉴 열기`} className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"><MessageAvatar name={sender.display_name} src={sender.avatar_url} size="sm" /></button> : null}
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%] ${mine ? 'rounded-br-md bg-stone-900 text-white' : 'rounded-bl-md border border-stone-100 bg-white text-stone-900'}`}>
                        {!mine ? <p className="mb-1 text-xs font-bold text-rose-700">{sender?.display_name ?? '이전 참여자'}</p> : null}
                        {message.text ? <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p> : null}
                        {message.image_url ? (
                          <button type="button" onClick={() => setLightboxUrl(imageUrl(message.image_url!))}
                            aria-label="이미지 크게 보기" className="mt-1 block overflow-hidden rounded-xl transition hover:opacity-85">
                            <img src={imageUrl(message.image_url)} alt="대화 이미지" loading="lazy" className="max-h-40 max-w-48 object-contain" />
                          </button>
                        ) : null}
                        <time dateTime={message.created_at} className="mt-1 block text-[11px] opacity-65">{formatDateTime(message.created_at)}</time>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!canSend ? (
                <p className="border-t border-stone-100 px-5 py-4 text-sm text-stone-500">
                  다른 활성 참여자가 없어 메시지를 보낼 수 없습니다.
                </p>
              ) : (
                <form onSubmit={submitMessage} className="border-t border-stone-100 bg-white px-3 py-3 sm:px-5">
                  {imageFile ? <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
                    <span className="min-w-0 truncate">첨부: {imageFile.name}</span>
                    <button type="button" onClick={() => { setImageState({ key: roomId ?? '', file: null }); if (fileInput.current) fileInput.current.value = ''; }} className="font-bold">제거</button>
                  </div> : null}
                  <div className="flex items-center gap-2">
                    <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} onChange={(event) => selectImage(event.target.files?.[0])}
                      className="hidden" aria-label="이미지 선택" />
                    <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50" aria-label="이미지 첨부">사진</button>
                    <input aria-label="메시지 내용" value={draft} onChange={(event) => setDraftState({ key: roomId ?? '', text: event.target.value })} maxLength={2000}
                      onCompositionStart={() => { isComposing.current = true; }} onCompositionEnd={() => { isComposing.current = false; }}
                      onKeyDown={(event) => { if (event.key === 'Enter' && (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                      placeholder="메시지를 입력하세요..." className="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-300 focus:bg-white" />
                    <button disabled={busy || (!draft.trim() && !imageFile)} type="submit"
                      className="rounded-full bg-stone-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-700 disabled:opacity-50">보내기</button>
                  </div>
                </form>
              )}
            </>
          ) : !roomId ? <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"><div className="flex size-16 items-center justify-center rounded-3xl bg-rose-100 text-3xl text-rose-700">✉</div><h2 className="mt-5 text-lg font-bold text-stone-900">대화를 시작해 보세요</h2><p className="mt-2 text-sm text-stone-500">왼쪽에서 대화방을 선택하거나 새로운 대화를 만드세요.</p><button type="button" onClick={startNew} className="mt-5 rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white">새 대화 만들기</button></div> : null}
        </section>
      </div>

      {profileAccount ? (
        <div role="presentation" className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileAccount(null); }}>
          <section role="dialog" aria-modal="true" aria-label={`${profileAccount.display_name} 프로필 메뉴`} className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <MessageAvatar name={profileAccount.display_name} src={profileAccount.avatar_url} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold text-stone-950">{profileAccount.display_name}</h2>
                  <p className="truncate text-sm text-stone-500">@{profileAccount.handle}</p>
                </div>
              </div>
              <button type="button" onClick={() => setProfileAccount(null)} aria-label="프로필 메뉴 닫기" className="rounded-full px-2 py-1 text-xl leading-none text-stone-500 hover:bg-stone-100">×</button>
            </div>
            {profileAccount.bio ? <p className="mt-4 whitespace-pre-wrap text-sm text-stone-600">{profileAccount.bio}</p> : null}
            <div className="mt-6 grid gap-2">
              <Link to={`/accounts/${profileAccount.id}`} onClick={() => setProfileAccount(null)} className="rounded-xl bg-stone-950 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-stone-700">프로필 피드 방문</Link>
              {!profileAccount.deactivated_at ? <button type="button" disabled={followBusy} onClick={() => void toggleProfileFollow()} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-800 transition hover:bg-stone-50 disabled:opacity-50">{following.some((account) => account.id === profileAccount.id) ? '팔로우 해제' : '팔로우'}</button> : null}
            </div>
          </section>
        </div>
      ) : null}

      {lightboxUrl ? (
        <div role="dialog" aria-modal="true" aria-label="이미지 크게 보기" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" onClick={() => setLightboxUrl(null)} className="absolute right-5 top-5 rounded bg-white px-3 py-1 text-sm font-bold text-neutral-900">닫기</button>
          <img src={lightboxUrl} alt="대화 이미지 확대" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}
