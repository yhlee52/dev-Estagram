import type { Account, FeedItem, FollowState, Post } from "../types/feed";

export function getAccountById(
  accounts: Account[],
  accountId: string,
): Account | undefined {
  return accounts.find((account) => account.id === accountId);
}

export function joinPostWithAccount(
  post: Post,
  accounts: Account[],
): FeedItem | undefined {
  const account = getAccountById(accounts, post.accountId);

  if (!account) {
    return undefined;
  }

  return { post, account };
}

export function sortPostsByCreatedAtDesc(posts: Post[]): Post[] {
  return [...posts].sort(
    (currentPost, nextPost) =>
      Date.parse(nextPost.createdAt) - Date.parse(currentPost.createdAt),
  );
}

export function getFeedItems(posts: Post[], accounts: Account[]): FeedItem[] {
  return sortPostsByCreatedAtDesc(posts)
    .map((post) => joinPostWithAccount(post, accounts))
    .filter((feedItem): feedItem is FeedItem => feedItem !== undefined);
}

export function getFollowedFeedItems(
  posts: Post[],
  accounts: Account[],
  follows: FollowState[],
): FeedItem[] {
  const followedAccountIds = new Set(
    follows
      .filter((followState) => followState.isFollowing)
      .map((followState) => followState.accountId),
  );

  return getFeedItems(
    posts.filter((post) => followedAccountIds.has(post.accountId)),
    accounts,
  );
}

export function getPostsByAccountId(posts: Post[], accountId: string): Post[] {
  return sortPostsByCreatedAtDesc(
    posts.filter((post) => post.accountId === accountId),
  );
}
