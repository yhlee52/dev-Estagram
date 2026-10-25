import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getAccount } from '../api/accountsApi';
import { getPost, updatePost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import PostEditor, { type PostEditorValues } from '../components/PostEditor';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import type { Account, Post } from '../types/feed';

function getEditPostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버를 확인해 주세요.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return '내 게시글만 수정할 수 있습니다.';
    }

    if (error.status === 404) {
      return '게시글 또는 계정을 찾지 못했습니다.';
    }

    return `게시글을 저장하지 못했습니다. (${error.status})`;
  }

  return '게시글을 저장하지 못했습니다. 다시 시도해 주세요.';
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

export default function EditPostPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const { activeApiUserId } = useActiveApiUser();
  const [post, setPost] = useState<Post | undefined>();
  const [account, setAccount] = useState<Account | undefined>();
  const [isLoading, setIsLoading] = useState(isApiMode());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isApiMode() || !postId) {
      return;
    }

    let isMounted = true;

    const loadPost = async () => {
      setIsLoading(true);
      setError('');

      try {
        const postResponse = await getPost(postId);
        const accountResponse = await getAccount(postResponse.account_id);

        if (isMounted) {
          setPost(mapApiPostToPost(postResponse, postResponse.assets));
          setAccount(mapApiAccountToAccount(accountResponse));
        }
      } catch (loadError) {
        if (isMounted) {
          setPost(undefined);
          setAccount(undefined);
          setError(getEditPostErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPost();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  if (!isApiMode()) {
    return (
      <EmptyState
        title="API 모드에서만 사용할 수 있습니다"
        description="게시글 수정은 API 모드에서 사용할 수 있습니다."
      />
    );
  }

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="로그인이 필요합니다"
        description="게시글을 수정하려면 로그인해 주세요."
      />
    );
  }

  if (isLoading) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
        게시글을 불러오는 중...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
        <Link className="block text-sm font-semibold text-neutral-950" to="/">
          홈
        </Link>
      </div>
    );
  }

  if (!post || !account || !postId) {
    return (
      <EmptyState
        title="게시글을 찾지 못했습니다"
        description="홈에서 수정할 게시글을 선택해 주세요."
      />
    );
  }

  const isOwnApiPost = getAccountUserId(account) === activeApiUserId;

  if (!isOwnApiPost) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="수정할 수 없습니다"
          description="내 게시글만 수정할 수 있습니다."
        />
        <Link
          className="block rounded-md bg-neutral-950 px-3 py-2 text-center text-sm font-bold text-white"
          to={`/posts/${postId}`}
        >
          게시글로 돌아가기
        </Link>
      </div>
    );
  }

  const handleSubmit = async (values: PostEditorValues) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const updatedPost = await updatePost(postId, {
        title: values.title,
        text: values.text,
        tags: values.tags,
        metadata_json: values.metadata_json,
        assets: values.assets,
        tagged_account_ids: values.tagged_account_ids,
      });
      setPost(mapApiPostToPost(updatedPost, updatedPost.assets));
      navigate(`/posts/${postId}`);
    } catch (updateError) {
      setSubmitError(getEditPostErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between gap-3">
        <Link
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          to={`/posts/${postId}`}
        >
          뒤로
        </Link>
        <p className="text-xs font-bold uppercase text-neutral-400">게시글 수정</p>
      </nav>

      <PostEditor
        mode="edit"
        initialPost={post}
        isSubmitting={isSubmitting}
        error={submitError}
        onCancel={() => navigate(`/posts/${postId}`)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
