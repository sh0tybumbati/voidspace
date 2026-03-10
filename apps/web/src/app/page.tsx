'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import PostCard from '@/components/posts/PostCard';
import Header from '@/components/layout/Header';
import LoadingCard from '@/components/ui/LoadingCard';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [feed, setFeed] = useState<'hot' | 'new' | 'top' | 'subscribed'>('hot');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [feed, page]);

  const fetchPosts = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.getPosts({
        feed,
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

  const handleFeedChange = (newFeed: typeof feed) => {
    setFeed(newFeed);
    setPage(1);
    setPosts([]);
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Feed selector */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFeedChange('hot')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    feed === 'hot'
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
                  onClick={() => handleFeedChange('new')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    feed === 'new'
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
                  onClick={() => handleFeedChange('top')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    feed === 'top'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  Top
                </button>
              </div>
            </div>

            {/* Posts */}
            {isLoading && page === 1 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600 dark:text-red-400">{error}</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No posts yet. Be the first to post!
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
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
            {/* Create post card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Create Post
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Share your thoughts, links, images, or videos with the community.
              </p>
              <a
                href="/submit"
                className="block w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-center rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium"
              >
                Create Post
              </a>
            </div>

            {/* Welcome card (only show when not logged in) */}
            {!user && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Welcome to Voidspace
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  A democratic social platform with transparent moderation and community governance.
                </p>
                <div className="space-y-2">
                  <a
                    href="/register"
                    className="block w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-center rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium"
                  >
                    Create Account
                  </a>
                  <a
                    href="/login"
                    className="block w-full px-4 py-2 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 text-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 font-medium"
                  >
                    Log In
                  </a>
                </div>
              </div>
            )}

            {/* About */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">About</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Voidspace is a community-driven platform where users have control over moderation through democratic elections and transparent governance.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
