'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import VoteButtons from '@/components/posts/VoteButtons';
import CommentTree from '@/components/comments/CommentTree';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import MarkdownEditor from '@/components/ui/MarkdownEditor';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const spaceName = params.name as string;
  const postId = params.postId as string;

  const [post, setPost] = useState<any>(null);
  const [spaceDetails, setSpaceDetails] = useState<any>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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
      setIsSaved(data.post.isSaved || false);

      // Verify post belongs to this space
      if (data.post.space.name !== spaceName) {
        setError('Post not found in this space');
        return;
      }

      // Fetch full space details
      try {
        const spaceData = await api.getSpace(spaceName);
        setSpaceDetails(spaceData.space);

        // Check if current user is a moderator
        if (user && spaceData.space.moderators) {
          const userMod = spaceData.space.moderators.find(
            (mod: any) => mod.user.username === user.username
          );
          setIsModerator(!!userMod);
        }
      } catch (err) {
        console.error('Failed to fetch space details:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deletePost(post.id);
      router.push(`/v/${spaceName}`);
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

  const handleEdit = () => {
    setEditTitle(post.title);
    setEditContent(post.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    if (editTitle.length > 300) {
      alert('Title must be 300 characters or less');
      return;
    }

    setIsSavingEdit(true);
    try {
      await api.updatePost(post.id, {
        title: editTitle.trim(),
        content: editContent.trim() || undefined,
      });

      // Refresh the post
      await fetchPost();
      setIsEditing(false);
    } catch (error: any) {
      alert(error.message || 'Failed to update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const isAuthor = user && post && post.author.username === user.username;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading post...</div>
        </main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-red-600 dark:text-red-400">
            {error || 'Post not found'}
          </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex">
                {/* Vote buttons */}
                <div className="bg-gray-50 dark:bg-gray-900 px-2 py-4 flex flex-col items-center">
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
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <a
                      href={`/v/${post.space.name}`}
                      className="font-bold text-gray-900 dark:text-gray-100 hover:underline"
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
                    {post.editedAt && post.editedAt !== post.createdAt && (
                      <>
                        <span>•</span>
                        <span className="italic">edited</span>
                      </>
                    )}
                  </div>

                  {/* Post title and content - Edit mode or display mode */}
                  {isEditing ? (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={300}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 dark:bg-gray-800"
                          disabled={isSavingEdit}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {editTitle.length}/300
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Content (optional)
                        </label>
                        <MarkdownEditor
                          value={editContent}
                          onChange={setEditContent}
                          maxLength={40000}
                          disabled={isSavingEdit}
                          minHeight="200px"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit || !editTitle.trim()}
                          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Post title */}
                      <div className="flex items-start gap-2 mb-3">
                        {postTypeIcons[post.postType as keyof typeof postTypeIcons]}
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1">
                          {post.title}
                        </h1>
                        {post.isNSFW && (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 text-xs font-semibold rounded">
                            NSFW
                          </span>
                        )}
                      </div>

                      {/* Post content */}
                      {post.content && (
                        <div className="mb-4">
                          <MarkdownRenderer
                            content={post.content}
                            className="text-gray-700 dark:text-gray-300"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Media preview */}
                  {post.url && (
                    <>
                      {/* Image */}
                      {post.postType === 'image' && (
                        <div className="mb-4 rounded-lg overflow-hidden">
                          <img
                            src={post.url}
                            alt={post.title}
                            className="w-full max-h-[600px] object-contain bg-gray-100 dark:bg-gray-900"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = `<a href="${post.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline text-sm block">${post.url}</a>`;
                            }}
                          />
                        </div>
                      )}

                      {/* Video - support for YouTube, Vimeo, and direct video links */}
                      {post.postType === 'video' && (
                        <div className="mb-4 rounded-lg overflow-hidden bg-black">
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
                              className="w-full max-h-[600px]"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = `<a href="${post.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline text-sm block p-4">${post.url}</a>`;
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
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-4 inline-block"
                        >
                          {post.url}
                        </a>
                      )}
                    </>
                  )}

                  {/* Post footer */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
                    <span className="font-medium">
                      {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                    </span>
                    {post.isEdited && <span>• edited</span>}

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

                    {/* Edit button (author only) */}
                    {isAuthor && !post.removed && !isEditing && (
                      <button
                        onClick={handleEdit}
                        className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Delete button (author only) */}
                    {isAuthor && !post.removed && !isEditing && (
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
                  </div>
                </div>
              </div>
            </div>

            {/* Comments section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Comments</h2>
              <CommentTree postId={post.id} spaceName={spaceName} isModerator={isModerator} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Space info card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                About v/{post.space.name}
              </h3>
              {spaceDetails && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {spaceDetails.description || 'No description yet.'}
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
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
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Rules</h3>
                <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                  {spaceDetails.rules.map((rule: any, index: number) => (
                    <li key={index}>
                      <span className="font-semibold">{rule.title || rule}</span>
                      {rule.description && (
                        <p className="ml-4 mt-1 text-gray-500 dark:text-gray-500">{rule.description}</p>
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
