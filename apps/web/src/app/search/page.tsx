'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import Header from '@/components/layout/Header';
import PostCard from '@/components/posts/PostCard';
import { formatDistanceToNow } from 'date-fns';

type FilterType = 'all' | 'posts' | 'spaces' | 'users';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<any>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.length >= 2) {
      performSearch();
    }
  }, [query, filter]);

  const performSearch = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.search(query, filter, 50);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getResultCount = () => {
    if (!results) return 0;
    if (filter === 'all') {
      return results.posts.length + results.spaces.length + results.users.length;
    } else if (filter === 'posts') {
      return results.posts.length;
    } else if (filter === 'spaces') {
      return results.spaces.length;
    } else {
      return results.users.length;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Search header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Search Results
          </h1>
          {query && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing results for &quot;<span className="font-semibold">{query}</span>&quot;
              {results && !isLoading && ` (${getResultCount()} ${getResultCount() === 1 ? 'result' : 'results'})`}
            </p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              All {results && `(${results.posts.length + results.spaces.length + results.users.length})`}
            </button>
            <button
              onClick={() => setFilter('posts')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                filter === 'posts'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Posts {results && `(${results.posts.length})`}
            </button>
            <button
              onClick={() => setFilter('spaces')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                filter === 'spaces'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Spaces {results && `(${results.spaces.length})`}
            </button>
            <button
              onClick={() => setFilter('users')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                filter === 'users'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Users {results && `(${results.users.length})`}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Searching...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Empty query state */}
        {!query && !isLoading && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Enter a search term to get started</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && results && query && (
          <div className="space-y-6">
            {/* Posts */}
            {(filter === 'all' || filter === 'posts') && results.posts.length > 0 && (
              <div>
                {filter === 'all' && (
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Posts
                  </h2>
                )}
                <div className="space-y-4">
                  {results.posts.map((post: any) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            )}

            {/* Spaces */}
            {(filter === 'all' || filter === 'spaces') && results.spaces.length > 0 && (
              <div>
                {filter === 'all' && (
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Spaces
                  </h2>
                )}
                <div className="space-y-3">
                  {results.spaces.map((space: any) => (
                    <Link
                      key={space.id}
                      href={`/v/${space.name}`}
                      className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-300">
                            {space.displayName[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            v/{space.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {space.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{space.subscriberCount.toLocaleString()} members</span>
                            <span>Created {formatDistanceToNow(new Date(space.createdAt), { addSuffix: true })}</span>
                            {space.isNsfw && (
                              <span className="px-1 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded font-semibold">
                                NSFW
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {(filter === 'all' || filter === 'users') && results.users.length > 0 && (
              <div>
                {filter === 'all' && (
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Users
                  </h2>
                )}
                <div className="space-y-3">
                  {results.users.map((user: any) => (
                    <Link
                      key={user.id}
                      href={`/u/${user.username}`}
                      className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-300">
                            {user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            u/{user.username}
                          </h3>
                          {user.bio && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {user.bio}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Alignment: {user.alignment || 0}</span>
                            <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {getResultCount() === 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No results found</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Try different keywords or check your spelling
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// useSearchParams() needs a Suspense boundary so Next can prerender the page shell.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
