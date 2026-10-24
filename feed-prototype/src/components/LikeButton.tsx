import { useEffect, useState, type MouseEvent } from 'react';
import { addLike, getLikes, removeLike, type LikeSummary } from '../api/likesApi';

export default function LikeButton({ postId, userId }: { postId: string; userId: string }) {
  const [summary, setSummary] = useState<LikeSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void getLikes(postId).then((value) => {
      if (live) setSummary(value);
    }).catch(() => {
      if (live) setError('Likes unavailable');
    });
    return () => { live = false; };
  }, [userId, postId]);

  if (!userId) return null;

  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!summary || pending) return;
    setPending(true);
    setError('');
    try {
      setSummary(await (summary.liked_by_me ? removeLike(postId) : addLike(postId)));
    } catch {
      setError('Could not update like');
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`${summary?.liked_by_me ? 'Unlike' : 'Like'} post; ${summary?.count ?? 0} likes`}
        aria-pressed={summary?.liked_by_me ?? false}
        disabled={!summary || pending}
        onClick={toggle}
        onKeyDown={(event) => event.stopPropagation()}
        className={`rounded-full px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${summary?.liked_by_me ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
      >
        {summary?.liked_by_me ? '♥' : '♡'} {summary?.count ?? '…'}
      </button>
      {error ? <span role="status" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
