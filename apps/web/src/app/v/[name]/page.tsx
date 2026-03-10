'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import PostCard from '@/components/posts/PostCard';
import LoadingCard from '@/components/ui/LoadingCard';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';

export default function SpacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const spaceName = params.name as string;

  const [space, setSpace] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchSpace();
  }, [spaceName]);

  useEffect(() => {
    fetchPosts();
  }, [spaceName, sortBy, page]);

  const fetchSpace = async () => {
    try {
      const data = await api.getSpace(spaceName);
      setSpace(data.space);
      setIsSubscribed(data.isSubscribed || false);

      // Check if current user is the founder or a moderator
      if (user && data.space.moderators) {
        const userMod = data.space.moderators.find(
          (mod: any) => mod.user.username === user.username
        );
        setIsModerator(!!userMod);
        setIsFounder(!!userMod?.isFounder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load space');
    }
  };

  const fetchPosts = async () => {
    setIsLoading(true);

    try {
      const data = await api.getSpacePosts(spaceName, {
        sort: sortBy,
        page,
        limit: 25,
      });

      if (page === 1) {
        setPosts(data.posts);
      } else {
        setPosts((prev) => [...prev, ...data.posts]);
      }

      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      if (isSubscribed) {
        await api.unsubscribeFromSpace(spaceName);
        setIsSubscribed(false);
        if (space) {
          setSpace({
            ...space,
            subscriberCount: space.subscriberCount - 1,
          });
        }
      } else {
        await api.subscribeToSpace(spaceName);
        setIsSubscribed(true);
        if (space) {
          setSpace({
            ...space,
            subscriberCount: space.subscriberCount + 1,
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to update subscription:', err);
    }
  };

  const handleSortChange = (newSort: typeof sortBy) => {
    setSortBy(newSort);
    setPage(1);
    setPosts([]);
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const handleDeleteSpace = async () => {
    try {
      await api.deleteSpace(spaceName);
      router.push('/spaces');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete space');
    }
  };

  if (error && !space) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-red-600 dark:text-red-400">{error}</div>
        </main>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading space...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      {/* Space banner */}
      <div className="bg-blue-600 dark:bg-blue-800 h-24"></div>

      {/* Space info */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-end gap-4 -mt-6">
            {/* Space icon */}
            <div className="w-20 h-20 bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-400">
              {space.displayName[0].toUpperCase()}
            </div>

            {/* Space name and stats */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {space.displayName}
                </h1>
                {space.isNsfw && (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-semibold rounded">
                    NSFW
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">v/{space.name}</p>
            </div>

            {/* Subscribe and Delete buttons */}
            <div className="pb-4 flex gap-2">
              <button
                onClick={handleSubscribe}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  isSubscribed
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>

              {isFounder && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-full font-medium bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                  title="Delete Space (Founder Only)"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Posts feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Sort controls */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSortChange('hot')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    sortBy === 'hot'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  Hot
                </button>

                <button
                  onClick={() => handleSortChange('new')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    sortBy === 'new'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  New
                </button>

                <button
                  onClick={() => handleSortChange('top')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    sortBy === 'top'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  Top
                </button>

                <div className="ml-auto">
                  <a
                    href={`/v/${space.name}/submit`}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm"
                  >
                    Create Post
                  </a>
                </div>
              </div>
            </div>

            {/* Posts */}
            {isLoading && page === 1 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No posts yet in this space.
                </p>
                <a
                  href={`/v/${space.name}/submit`}
                  className="inline-block px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium"
                >
                  Be the first to post!
                </a>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} showSpace={false} isModerator={isModerator} />
                  ))}
                </div>

                {/* Load more button */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* About card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                About Community
              </h2>

              {space.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {space.description}
                </p>
              )}

              {space.sidebarContent && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap">
                  {space.sidebarContent}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Members</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {space.subscriberCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatDistanceToNow(new Date(space.createdAt))} ago
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <a
                  href={`/v/${space.name}/submit`}
                  className="block w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-center rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm"
                >
                  Create Post
                </a>
              </div>
            </div>

            {/* Moderators */}
            {space.moderators && space.moderators.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Moderators
                </h3>
                <div className="space-y-2 mb-3">
                  {space.moderators.map((mod: any) => (
                    <div key={mod.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300">
                        {mod.user.username[0].toUpperCase()}
                      </div>
                      <a
                        href={`/u/${mod.user.username}`}
                        className="text-sm text-gray-700 dark:text-gray-300 hover:underline"
                      >
                        u/{mod.user.username}
                      </a>
                      {mod.isFounder && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">(Founder)</span>
                      )}
                    </div>
                  ))}
                </div>
                <a
                  href={`/v/${space.name}/modlog`}
                  className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Moderation Log
                </a>
              </div>
            )}

            {/* Rules */}
            {space.rules && space.rules.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Rules</h3>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-3 list-decimal list-inside">
                  {space.rules.map((rule: any, index: number) => (
                    <li key={index}>
                      <span className="font-semibold">{rule.title || rule}</span>
                      {rule.description && (
                        <p className="ml-5 mt-1 text-gray-500 dark:text-gray-400">{rule.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Delete Space?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>v/{space.name}</strong>? This action cannot be undone and will permanently delete all posts, comments, and related data.
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
              ⚠️ Note: This is a development feature. In production, space deletion will require a community vote.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSpace}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
