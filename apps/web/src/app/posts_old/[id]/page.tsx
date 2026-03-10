'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import VoteButtons from '@/components/posts/VoteButtons';
import CommentTree from '@/components/comments/CommentTree';
import { formatDistanceToNow } from 'date-fns';

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<any>(null);
  const [spaceDetails, setSpaceDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.getPost(postId);
      setPost(data.post);

      // Fetch full space details
      try {
        const spaceData = await api.getSpace(data.post.space.name);
        setSpaceDetails(spaceData.space);
      } catch (err) {
        console.error('Failed to fetch space details:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load post');
    } finally {
      setIsLoading(false);
    }
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
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500">Loading post...</div>
        </main>
      </div>
    );
  }

  if (error) {
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
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-red-600">{error}</div>
        </main>
      </div>
    );
  }

  const postTypeIcons = {
    text: (
      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v12H6V4z" clipRule="evenodd" />
      </svg>
    ),
    link: (
      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
      </svg>
    ),
    image: (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    ),
    video: (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
      </svg>
    ),
  };

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
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex">
                {/* Vote buttons */}
                <div className="bg-gray-50 px-2 py-4 flex flex-col items-center">
                  <VoteButtons
                    targetId={post.id}
                    targetType="post"
                    initialVoteScore={post.voteScore}
                    initialUserVote={post.userVote}
                  />
                </div>

                {/* Post content */}
                <div className="flex-1 p-4">
                  {/* Post metadata */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <a
                      href={`/v/${post.space.name}`}
                      className="font-bold text-gray-900 hover:underline"
                    >
                      v/{post.space.name}
                    </a>
                    <span>•</span>
                    <span>
                      Posted by{' '}
                      <a
                        href={`/u/${post.author.username}`}
                        className="hover:underline"
                      >
                        u/{post.author.username}
                      </a>
                    </span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                  </div>

                  {/* Post title */}
                  <div className="flex items-start gap-2 mb-3">
                    {postTypeIcons[post.postType as keyof typeof postTypeIcons]}
                    <h1 className="text-xl font-bold text-gray-900 flex-1">
                      {post.title}
                    </h1>
                    {post.isNSFW && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                        NSFW
                      </span>
                    )}
                  </div>

                  {/* Post content */}
                  {post.content && (
                    <div className="text-gray-700 whitespace-pre-wrap mb-4">
                      {post.content}
                    </div>
                  )}

                  {/* Post URL */}
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm mb-4 inline-block"
                    >
                      {post.url}
                    </a>
                  )}

                  {/* Post footer */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span className="font-medium">
                      {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                    </span>
                    {post.isEdited && <span>• edited</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Comments section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Comments</h2>
              <CommentTree postId={post.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Space info card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">
                About v/{post.space.name}
              </h3>
              {spaceDetails && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {spaceDetails.description || 'No description yet.'}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <div>
                      <span className="font-semibold">{spaceDetails.subscriberCount}</span>{' '}
                      {spaceDetails.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                    </div>
                    <div>
                      Created {formatDistanceToNow(new Date(spaceDetails.createdAt))} ago
                    </div>
                  </div>
                </>
              )}
              <a
                href={`/v/${post.space.name}`}
                className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                View Space
              </a>
            </div>

            {/* Space rules */}
            {spaceDetails?.rules && spaceDetails.rules.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Rules</h3>
                <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                  {spaceDetails.rules.map((rule: any, index: number) => (
                    <li key={index}>
                      <span className="font-semibold">{rule.title || rule}</span>
                      {rule.description && (
                        <p className="ml-4 mt-1 text-gray-500">{rule.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
