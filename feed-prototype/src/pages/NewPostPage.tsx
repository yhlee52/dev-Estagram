import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { createPost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import EmptyState from '../components/EmptyState';
import PostEditor, { type PostEditorValues } from '../components/PostEditor';

function getCreatePostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버를 확인해 주세요.`;
  }

  if (error instanceof ApiClientError) {
    return `게시글을 작성하지 못했습니다. (${error.status})`;
  }

  return '게시글을 작성하지 못했습니다. 다시 시도해 주세요.';
}

export default function NewPostPage() {
  const navigate = useNavigate();
  const { activeApiUserId } = useActiveApiUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isApiMode()) {
    return (
      <EmptyState
        title="API 모드에서만 사용할 수 있습니다"
        description="게시글 작성은 API 모드에서 사용할 수 있습니다."
      />
    );
  }

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="로그인이 필요합니다"
        description="게시글을 작성하려면 로그인해 주세요."
      />
    );
  }

  const handleSubmit = async (values: PostEditorValues) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const createdItem = await createPost({
        title: values.title,
        text: values.text,
        tags: values.tags,
        metadata_json: values.metadata_json,
        assets: values.assets,
      });

      navigate(`/posts/${createdItem.post.id}`);
    } catch (createError) {
      setError(getCreatePostErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between gap-3">
        <Link
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          to="/"
        >
          취소
        </Link>
        <p className="text-xs font-bold uppercase text-neutral-400">
          새 게시글
        </p>
      </nav>

      <PostEditor
        mode="create"
        isSubmitting={isSubmitting}
        error={error}
        onCancel={() => navigate('/')}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
