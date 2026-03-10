'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import PostForm from '@/components/posts/PostForm';

export default function SubmitPostPage() {
  const params = useParams();
  const router = useRouter();
  const spaceName = params.name as string;

  const [space, setSpace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSpace();
  }, [spaceName]);

  const fetchSpace = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.getSpace(spaceName);
      setSpace(data.space);
    } catch (err: any) {
      setError(err.message || 'Failed to load space');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    content?: string;
    postType: 'text' | 'link' | 'image' | 'video';
    url?: string;
    isNsfw: boolean;
  }) => {
    if (!space) return;

    const response = await api.createPost({
      spaceId: space.id,
      title: data.title,
      content: data.content,
      postType: data.postType,
      url: data.url,
      isNsfw: data.isNsfw,
    });

    // Redirect to the new post
    router.push(`/v/${space.name}/${response.post.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold text-gray-900">
                Voidspace
              </a>
              <div className="flex items-center gap-4">
                <a href="/spaces" className="text-sm text-gray-600 hover:text-gray-900">
                  Explore Spaces
                </a>
                <a href="/u/testuser" className="text-sm text-gray-600 hover:text-gray-900">
                  Profile
                </a>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500">Loading...</div>
        </main>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold text-gray-900">
                Voidspace
              </a>
              <div className="flex items-center gap-4">
                <a href="/spaces" className="text-sm text-gray-600 hover:text-gray-900">
                  Explore Spaces
                </a>
                <a href="/u/testuser" className="text-sm text-gray-600 hover:text-gray-900">
                  Profile
                </a>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-red-600">
            {error || 'Space not found'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="text-2xl font-bold text-gray-900">
              Voidspace
            </a>
            <div className="flex items-center gap-4">
              <a href="/spaces" className="text-sm text-gray-600 hover:text-gray-900">
                Explore Spaces
              </a>
              <a href="/u/testuser" className="text-sm text-gray-600 hover:text-gray-900">
                Profile
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Create a post
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <a href={`/v/${space.name}`} className="hover:underline">
              v/{space.name}
            </a>
            <span>•</span>
            <span>{space.displayName}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <PostForm
            spaceId={space.id}
            spaceName={space.name}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Space rules reminder */}
        {space.rules && space.rules.length > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">
              v/{space.name} Rules
            </h3>
            <ol className="text-xs text-yellow-800 space-y-1 list-decimal list-inside">
              {space.rules.map((rule: any, index: number) => (
                <li key={index}>
                  {rule.title || rule}
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
