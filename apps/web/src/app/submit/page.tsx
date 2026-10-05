'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import PostForm from '@/components/posts/PostForm';
import Header from '@/components/layout/Header';

function SubmitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push('/login?redirect=/submit');
      return;
    }

    if (user) {
      fetchSpaces();
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Check if a space was pre-selected via query param
    const spaceParam = searchParams.get('space');
    if (spaceParam && spaces.length > 0) {
      const space = spaces.find(s => s.name === spaceParam);
      if (space) {
        setSelectedSpace(space);
      }
    }
  }, [searchParams, spaces]);

  const fetchSpaces = async () => {
    setIsLoadingSpaces(true);
    try {
      // Fetch spaces - ideally subscribed spaces first
      const data = await api.getSpaces({ limit: 100, sortBy: 'subscribers' });
      setSpaces(data.spaces || []);

      // Auto-select first space if no query param
      if (!searchParams.get('space') && data.spaces.length > 0) {
        setSelectedSpace(data.spaces[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load spaces');
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    content?: string;
    postType: 'text' | 'link' | 'image' | 'video';
    url?: string;
    isNsfw: boolean;
  }) => {
    if (!selectedSpace) {
      throw new Error('Please select a space');
    }

    const response = await api.createPost({
      spaceId: selectedSpace.id,
      title: data.title,
      content: data.content,
      postType: data.postType,
      url: data.url,
      isNsfw: data.isNsfw,
    });

    // Redirect to the new post
    router.push(`/v/${selectedSpace.name}/${response.post.id}`);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {authLoading ? 'Loading...' : 'Redirecting to login...'}
          </div>
        </main>
      </div>
    );
  }

  if (isLoadingSpaces) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading spaces...</div>
        </main>
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No spaces available</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need to create or join a space before you can post.
            </p>
            <a
              href="/spaces"
              className="inline-block px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium"
            >
              Explore Spaces
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create a post</h1>

          {/* Space selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Choose a space
            </label>
            <select
              value={selectedSpace?.id || ''}
              onChange={(e) => {
                const space = spaces.find(s => s.id === e.target.value);
                setSelectedSpace(space || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Select a space...</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  v/{space.name} - {space.displayName}
                </option>
              ))}
            </select>

            {selectedSpace && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300">
                  {selectedSpace.displayName[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedSpace.displayName}
                  </div>
                  <div className="text-xs">
                    {selectedSpace.subscriberCount} members
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedSpace ? (
          <>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <PostForm
                spaceId={selectedSpace.id}
                spaceName={selectedSpace.name}
                onSubmit={handleSubmit}
                cancelUrl="/"
              />
            </div>

            {/* Space rules reminder */}
            {selectedSpace.rules && selectedSpace.rules.length > 0 && (
              <div className="mt-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  v/{selectedSpace.name} Rules
                </h3>
                <ol className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-decimal list-inside">
                  {selectedSpace.rules.map((rule: any, index: number) => (
                    <li key={index}>
                      {rule.title || rule}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Please select a space to continue
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// useSearchParams() needs a Suspense boundary so Next can prerender the page shell.
export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitPageContent />
    </Suspense>
  );
}
