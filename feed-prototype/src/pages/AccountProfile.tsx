import { useParams } from 'react-router';
import EmptyState from '../components/EmptyState';

export default function AccountProfile() {
  const { accountId } = useParams();

  return (
    <EmptyState
      title="AccountProfile page"
      description={`Account route placeholder${accountId ? `: ${accountId}` : ''}.`}
    />
  );
}
