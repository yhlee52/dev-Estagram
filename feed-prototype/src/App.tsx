import { createBrowserRouter, RouterProvider } from 'react-router';
import { AccountDirectoryProvider } from './components/AccountDirectoryProvider';
import AppShell from './components/AppShell';
import AccountProfile from './pages/AccountProfile';
import AccountsPage from './pages/AccountsPage';
import HomeFeed from './pages/HomeFeed';
import ImportsPage from './pages/ImportsPage';
import ImportBatchDetailPage from './pages/ImportBatchDetailPage';
import MePage from './pages/MePage';
import EditPostPage from './pages/EditPostPage';
import NewPostPage from './pages/NewPostPage';
import PostDetail from './pages/PostDetail';
import PostsBrowsePage from './pages/PostsBrowsePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomeFeed />,
      },
      {
        path: 'accounts',
        element: <AccountsPage />,
      },
      {
        path: 'accounts/:accountId',
        element: <AccountProfile />,
      },
      {
        path: 'me',
        element: <MePage />,
      },
      {
        path: 'imports',
        element: <ImportsPage />,
      },
      {
        path: 'imports/:batchExternalId',
        element: <ImportBatchDetailPage />,
      },
      {
        path: 'posts',
        element: <PostsBrowsePage />,
      },
      {
        path: 'posts/new',
        element: <NewPostPage />,
      },
      {
        path: 'posts/:postId',
        element: <PostDetail />,
      },
      {
        path: 'posts/:postId/edit',
        element: <EditPostPage />,
      },
    ],
  },
]);

export default function App() {
  return (
    <AccountDirectoryProvider>
      <RouterProvider router={router} />
    </AccountDirectoryProvider>
  );
}
