import { useParams } from 'react-router';
import EmptyState from '../components/EmptyState';

export default function PostDetail() {
  const { postId } = useParams();

  return (
    <EmptyState
      title="PostDetail page"
      description={`Post route placeholder${postId ? `: ${postId}` : ''}.`}
    />
  );
}
