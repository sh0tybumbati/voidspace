'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import VoteButtons from './VoteButtons';
import ModActions from '../moderation/ModActions';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import MarkdownRenderer from '../ui/MarkdownRenderer';

interface Post {
  id: string;
  title: string;
  content?: string | null;
  postType: string;
  url?: string | null;
  createdAt: string;
  voteScore: number;
  commentCount: number;
  isNsfw: boolean;
  removed?: boolean;
  removalReason?: string;
  author: {
    username: string;
    avatarUrl?: string | null;
  };
  space: {
    name: string;
    displayName: string;
    isNsfw?: boolean;
  };
  userVote?: number | null;
  isSaved?: boolean;
}

interface PostCardProps {
  post: Post;
  showSpace?: boolean;
  compact?: boolean;
  isModerator?: boolean;
}

export default function PostCard({
  post,
  showSpace = true,
  compact = false,
  isModerator = false,
}: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isSaving, setIsSaving] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const isAuthor = user && post.author.username === user.username;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deletePost(post.id);
      // Check if we're on the post detail page by looking at the URL
      const isOnPostPage = window.location.pathname.includes(`/${post.id}`);
      if (isOnPostPage) {
        // Redirect to the space page if we're viewing the deleted post
        router.push(`/v/${post.space.name}`);
      } else {
        // Force a refresh by navigating to the current page
        window.location.reload();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete post');
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('You must be logged in to save posts');
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        await api.unsavePost(post.id);
        setIsSaved(false);
      } else {
        await api.savePost(post.id);
        setIsSaved(true);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to save post');
    } finally {
      setIsSaving(false);
    }
  };

  const getPostTypeIcon = () => {
    switch (post.postType) {
      case 'link':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      case 'image':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex gap-2 p-2">
        {/* Vote buttons */}
        <div className="flex-shrink-0">
          <VoteButtons
            targetId={post.id}
            targetType="post"
            initialVoteScore={post.voteScore}
            initialUserVote={post.userVote || null}
          />
        </div>

        {/* Post content */}
        <div className="flex-1 min-w-0">
          {/* Meta info */}
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
            {showSpace && (
              <>
                <Link
                  href={`/v/${post.space.name}`}
                  className="font-semibold hover:underline"
                >
                  v/{post.space.name}
                </Link>
                <span>•</span>
              </>
            )}
            <span>Posted by</span>
            <Link
              href={`/u/${post.author.username}`}
              className="hover:underline"
            >
              u/{post.author.username}
            </Link>
            <span>•</span>
            <span>{timeAgo}</span>
            {post.isNsfw && (
              <>
                <span>•</span>
                <span className="px-1 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs font-semibold">
                  NSFW
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <Link href={`/v/${post.space.name}/${post.id}`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 mb-1">
              <span className="inline-flex items-center gap-1">
                {getPostTypeIcon()}
                {post.title}
              </span>
            </h3>
          </Link>

          {/* Content preview or removal notice */}
          {!compact && (
            <>
              {post.removed ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                  {post.removalReason === 'Deleted by author'
                    ? '[deleted by author]'
                    : '[removed by moderator]'}
                </p>
              ) : post.content ? (
                <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-2">
                  <MarkdownRenderer
                    content={post.content}
                    className="text-gray-700 dark:text-gray-300"
                  />
                </div>
              ) : null}
            </>
          )}

          {/* Media preview */}
          {!compact && post.url && (
            <>
              {/* Image */}
              {post.postType === 'image' && (
                <div className="mb-2 rounded-lg overflow-hidden">
                  <img
                    src={post.url}
                    alt={post.title}
                    className="w-full max-h-[500px] object-contain bg-gray-100 dark:bg-gray-900"
                    onError={(e) => {
                      // Fallback to link if image fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<a href="${post.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 dark:text-blue-400 hover:underline block">${post.url}</a>`;
                    }}
                  />
                </div>
              )}

              {/* Video - support for YouTube, Vimeo, and direct video links */}
              {post.postType === 'video' && (
                <div className="mb-2 rounded-lg overflow-hidden bg-black">
                  {post.url.includes('youtube.com') || post.url.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${(() => {
                        if (post.url.includes('youtu.be')) {
                          return post.url.split('/').pop()?.split('?')[0];
                        } else if (post.url.includes('/shorts/')) {
                          return post.url.split('/shorts/')[1]?.split('?')[0];
                        } else {
                          return new URL(post.url).searchParams.get('v');
                        }
                      })()}`}
                      className="w-full aspect-video"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : post.url.includes('vimeo.com') ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${post.url.split('/').pop()}`}
                      className="w-full aspect-video"
                      allowFullScreen
                      allow="autoplay; fullscreen; picture-in-picture"
                    />
                  ) : (
                    <video
                      controls
                      className="w-full max-h-[500px]"
                      onError={(e) => {
                        // Fallback to link if video fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `<a href="${post.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 dark:text-blue-400 hover:underline block p-4">${post.url}</a>`;
                      }}
                    >
                      <source src={post.url} type="video/mp4" />
                      <source src={post.url} type="video/webm" />
                      <source src={post.url} type="video/ogg" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              )}

              {/* Link */}
              {post.postType === 'link' && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline block mb-2"
                >
                  {post.url}
                </a>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <Link
              href={`/v/${post.space.name}/${post.id}`}
              className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
            </Link>

            <button className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded disabled:opacity-50 ${
                isSaved ? 'text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}</span>
            </button>

            {/* Delete button (author only) */}
            {isAuthor && !post.removed && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded text-red-600 dark:text-red-400 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            )}

            {/* Mod Actions */}
            <ModActions
              type="post"
              targetId={post.id}
              authorUsername={post.author.username}
              spaceName={post.space.name}
              isModerator={isModerator}
              isRemoved={post.removed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
