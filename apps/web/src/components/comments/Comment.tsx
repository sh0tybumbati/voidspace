'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import VoteButtons from '../posts/VoteButtons';
import CommentForm from './CommentForm';
import ModActions from '../moderation/ModActions';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import MarkdownEditor from '../ui/MarkdownEditor';

interface CommentProps {
  comment: {
    id: string;
    content: string;
    imageUrl?: string;
    createdAt: string;
    editedAt?: string;
    voteScore: number;
    depthLevel: number;
    removed?: boolean;
    removalReason?: string;
    author: {
      username: string;
      avatarUrl?: string;
    };
    userVote?: number | null;
    isSaved?: boolean;
    replies?: any[];
  };
  postId: string;
  spaceName: string;
  isModerator?: boolean;
  onReply?: (commentId: string, content: string, imageUrl?: string) => Promise<void>;
  depth?: number;
}

export default function Comment({ comment, postId, spaceName, isModerator = false, onReply, depth = 0 }: CommentProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(comment.isSaved || false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [showEditImage, setShowEditImage] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isEdited = comment.editedAt && comment.editedAt !== comment.createdAt;
  const isAuthor = user && comment.author.username === user.username;

  const handleReply = async (content: string, imageUrl?: string) => {
    if (onReply) {
      await onReply(comment.id, content, imageUrl);
      setIsReplying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteComment(comment.id);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to delete comment');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('You must be logged in to save comments');
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        await api.unsaveComment(comment.id);
        setIsSaved(false);
      } else {
        await api.saveComment(comment.id);
        setIsSaved(true);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to save comment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setEditContent(comment.content);
    setEditImageUrl(comment.imageUrl || '');
    setShowEditImage(!!comment.imageUrl);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setEditImageUrl('');
    setShowEditImage(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      alert('Comment cannot be empty');
      return;
    }

    if (editContent.length > 10000) {
      alert('Comment is too long (max 10,000 characters)');
      return;
    }

    setIsSavingEdit(true);
    try {
      await api.updateComment(comment.id, {
        content: editContent.trim(),
        imageUrl: editImageUrl.trim() || null,
      });

      // Refresh the page to show updated comment
      router.refresh();
      setIsEditing(false);
    } catch (error: any) {
      alert(error.message || 'Failed to update comment');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className={`flex gap-2 ${depth > 0 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      {/* Vote buttons */}
      <div className="flex-shrink-0 pt-1">
        <VoteButtons
          targetId={comment.id}
          targetType="comment"
          initialVoteScore={comment.voteScore}
          initialUserVote={comment.userVote || null}
        />
      </div>

      {/* Comment content */}
      <div className="flex-1 min-w-0">
        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
          <Link
            href={`/u/${comment.author.username}`}
            className="font-semibold hover:underline"
          >
            {comment.author.username}
          </Link>
          <span>•</span>
          <span>{timeAgo}</span>
          {isEdited && (
            <>
              <span>•</span>
              <span className="italic">edited</span>
            </>
          )}
        </div>

        {/* Comment text or edit form */}
        {isEditing ? (
          <div className="space-y-2 mb-2">
            <MarkdownEditor
              value={editContent}
              onChange={setEditContent}
              maxLength={10000}
              disabled={isSavingEdit}
              minHeight="100px"
            />

            {/* Image URL input */}
            {showEditImage ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="Image URL (optional)"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-800"
                  disabled={isSavingEdit}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowEditImage(false);
                    setEditImageUrl('');
                  }}
                  className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                  disabled={isSavingEdit}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowEditImage(true)}
                disabled={isSavingEdit}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editContent.trim()}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSavingEdit ? 'Saving...' : 'Save'}
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
            {/* Comment text or removal notice */}
            <div className="text-sm mb-2">
              {comment.removed ? (
                <span className="text-gray-500 dark:text-gray-400 italic">
                  {comment.removalReason === 'Deleted by author'
                    ? '[deleted by author]'
                    : '[removed by moderator]'}
                </span>
              ) : (
                <MarkdownRenderer
                  content={comment.content}
                  className="text-gray-900 dark:text-gray-100"
                />
              )}
            </div>

            {/* Image */}
            {!comment.removed && comment.imageUrl && (
              <div className="mb-2 rounded-lg overflow-hidden max-w-md">
                <img
                  src={comment.imageUrl}
                  alt="Comment image"
                  className="w-full max-h-[400px] object-contain bg-gray-100 dark:bg-gray-900"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded font-semibold"
          >
            Reply
          </button>

          <button className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded">
            Share
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded disabled:opacity-50 ${
              isSaved ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
          </button>

          <button className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded">
            Report
          </button>

          {/* Edit button (author only) */}
          {isAuthor && !comment.removed && !isEditing && (
            <button
              onClick={handleEdit}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded font-semibold"
            >
              Edit
            </button>
          )}

          {/* Delete button (author only) */}
          {isAuthor && !comment.removed && !isEditing && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}

          {/* Mod Actions */}
          <ModActions
            type="comment"
            targetId={comment.id}
            authorUsername={comment.author.username}
            spaceName={spaceName}
            isModerator={isModerator}
            isRemoved={comment.removed}
          />

          {comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded font-semibold"
            >
              {showReplies ? 'Hide' : 'Show'} {comment.replies.length}{' '}
              {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mb-3">
            <CommentForm
              postId={postId}
              parentCommentId={comment.id}
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              placeholder="Write a reply..."
            />
          </div>
        )}

        {/* Nested replies */}
        {showReplies && comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply: any) => (
              <Comment
                key={reply.id}
                comment={reply}
                postId={postId}
                spaceName={spaceName}
                isModerator={isModerator}
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
