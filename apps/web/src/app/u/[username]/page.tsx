'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import Header from '@/components/layout/Header';
import PostCard from '@/components/posts/PostCard';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  username: string;
  createdAt: string;
  alignment: number;
  avatarUrl: string | null;
  bio: string | null;
  postCount?: number;
  commentCount?: number;
  moderatorOf?: Array<{
    name: string;
    displayName: string;
    subscriberCount: number;
    isFounder: boolean;
    moderatorSince: string;
  }>;
}

interface SpaceAlignmentStats {
  username: string;
  space: {
    name: string;
    displayName: string;
  };
  spaceAlignment: number;
  postAlignment: number;
  commentAlignment: number;
  postCount: number;
  commentCount: number;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  postType: string;
  voteScore: number;
  commentCount: number;
  createdAt: string;
  isNsfw: boolean;
  space: {
    name: string;
    displayName: string;
    isNsfw: boolean;
  };
  author: {
    username: string;
    avatarUrl: string | null;
  };
  userVote?: number | null;
}

interface Comment {
  id: string;
  content: string;
  voteScore: number;
  createdAt: string;
  post: {
    id: string;
    title: string;
    space: {
      name: string;
      displayName: string;
    };
  };
  author: {
    username: string;
    avatarUrl: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

type Tab = 'posts' | 'comments' | 'about';

export default function UserProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = params.username as string;
  const spaceFilter = searchParams.get('space');

  const [user, setUser] = useState<User | null>(null);
  const [spaceStats, setSpaceStats] = useState<SpaceAlignmentStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [postsPagination, setPostsPagination] = useState<Pagination | null>(null);
  const [commentsPagination, setCommentsPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchUser();
    if (spaceFilter) {
      fetchSpaceStats();
    } else {
      setSpaceStats(null);
    }
  }, [username, spaceFilter]);

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchPosts();
    } else {
      fetchComments();
    }
  }, [activeTab, currentPage, username, spaceFilter]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const data = await api.getUserProfile(username);
      setUser(data.user);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      setError(error.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpaceStats = async () => {
    if (!spaceFilter) return;

    try {
      const data = await api.getUserSpaceAlignment(username, spaceFilter);
      setSpaceStats(data);
    } catch (error) {
      console.error('Error fetching space stats:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await api.getUserPosts(username, currentPage, 25, spaceFilter || undefined);
      setPosts(data.posts);
      setPostsPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await api.getUserComments(username, currentPage, 25, spaceFilter || undefined);
      setComments(data.comments);
      setCommentsPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const clearSpaceFilter = () => {
    router.push(`/u/${username}`);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <p className="text-red-600 dark:text-red-400 text-lg">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user && loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pagination = activeTab === 'posts' ? postsPagination : commentsPagination;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Space Filter Banner */}
        {spaceStats && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Showing activity in
                  </span>
                  <Link
                    href={`/v/${spaceStats.space.name}`}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    v/{spaceStats.space.name}
                  </Link>
                  <button
                    onClick={clearSpaceFilter}
                    className="ml-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    [clear filter]
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Space Alignment:</span>
                    <div className={`text-lg font-bold ${
                      spaceStats.spaceAlignment > 0
                        ? 'text-green-600 dark:text-green-400'
                        : spaceStats.spaceAlignment < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {spaceStats.spaceAlignment}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Posts:</span>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {spaceStats.postCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Post Alignment:</span>
                    <div className={`text-lg font-bold ${
                      spaceStats.postAlignment > 0
                        ? 'text-green-600 dark:text-green-400'
                        : spaceStats.postAlignment < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {spaceStats.postAlignment}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Comments:</span>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {spaceStats.commentCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Comment Alignment:</span>
                    <div className={`text-lg font-bold ${
                      spaceStats.commentAlignment > 0
                        ? 'text-green-600 dark:text-green-400'
                        : spaceStats.commentAlignment < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {spaceStats.commentAlignment}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Header */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 dark:text-blue-300">
              {user.username[0].toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                u/{user.username}
              </h1>

              {user.bio && (
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {user.bio}
                </p>
              )}

              <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-semibold">
                    {spaceFilter ? 'Global Alignment:' : 'Alignment:'}
                  </span>{' '}
                  <span className={`font-bold ${
                    user.alignment > 0
                      ? 'text-green-600 dark:text-green-400'
                      : user.alignment < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {user.alignment}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Joined:</span>{' '}
                  {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleTabChange('posts')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Posts {user.postCount !== undefined ? `(${user.postCount})` : postsPagination && `(${postsPagination.totalCount})`}
            </button>
            <button
              onClick={() => handleTabChange('comments')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'comments'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Comments {user.commentCount !== undefined ? `(${user.commentCount})` : commentsPagination && `(${commentsPagination.totalCount})`}
            </button>
            <button
              onClick={() => handleTabChange('about')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'about'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              About
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'about' ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="space-y-6">
              {user.moderatorOf && user.moderatorOf.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                    Moderator of {user.moderatorOf.length} {user.moderatorOf.length === 1 ? 'space' : 'spaces'}
                  </h3>
                  <div className="space-y-2">
                    {user.moderatorOf.map((space) => (
                      <Link
                        key={space.name}
                        href={`/v/${space.name}`}
                        className="flex items-center justify-between p-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            v/{space.name}
                            {space.isFounder && (
                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                                (Founder)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {space.subscriberCount.toLocaleString()} members • Moderator since {formatDistanceToNow(new Date(space.moderatorSince), { addSuffix: true })}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Account</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Joined:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Account Age:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatDistanceToNow(new Date(user.createdAt))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : activeTab === 'posts' ? (
          <>
            {posts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {spaceFilter ? `No posts in v/${spaceFilter}` : 'No posts yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {comments.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {spaceFilter ? `No comments in v/${spaceFilter}` : 'No comments yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {comment.author.username} commented on{' '}
                      <Link
                        href={`/v/${comment.post.space.name}/${comment.post.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {comment.post.title}
                      </Link>
                      {' in '}
                      <Link
                        href={`/v/${comment.post.space.name}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        v/{comment.post.space.name}
                      </Link>
                    </div>
                    <div className="text-gray-900 dark:text-gray-100 mb-2">
                      {comment.content}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{comment.voteScore} points</span>
                      <span>
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
              Page {currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
