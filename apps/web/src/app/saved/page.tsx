'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/layout/Header';
import PostCard from '@/components/posts/PostCard';

export default function SavedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedComments, setSavedComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchSavedContent();
  }, [user]);

  const fetchSavedContent = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [postsData, commentsData] = await Promise.all([
        api.getSavedPosts(),
        api.getSavedComments(),
      ]);

      setSavedPosts(postsData.posts || []);
      setSavedComments(commentsData.comments || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved content');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Saved Content
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and manage your saved posts and comments
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'posts'
                ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Posts ({savedPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'comments'
                ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Comments ({savedComments.length})
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading saved content...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : (
          <>
            {activeTab === 'posts' && (
              <div className="space-y-4">
                {savedPosts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <p className="text-lg font-medium">No saved posts yet</p>
                    <p className="text-sm mt-1">
                      Posts you save will appear here
                    </p>
                  </div>
                ) : (
                  savedPosts.map((post) => (
                    <PostCard key={post.id} post={post} showSpace={true} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                {savedComments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <p className="text-lg font-medium">No saved comments yet</p>
                    <p className="text-sm mt-1">
                      Comments you save will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                              <span className="font-semibold">
                                {comment.author.username}
                              </span>
                              <span>•</span>
                              <span>in</span>
                              <a
                                href={`/v/${comment.post.space.name}/${comment.post.id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {comment.post.title}
                              </a>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
