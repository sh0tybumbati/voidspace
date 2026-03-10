'use client';

import { useState, useEffect } from 'react';
import Comment from './Comment';
import CommentForm from './CommentForm';
import { api } from '@/lib/api';

interface CommentTreeProps {
  postId: string;
  spaceName: string;
  isModerator?: boolean;
}

export default function CommentTree({ postId, spaceName, isModerator = false }: CommentTreeProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'top' | 'new' | 'old'>('top');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchComments();
  }, [postId, sortBy]);

  const fetchComments = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.getPostComments(postId, sortBy);

      // Build comment tree
      const commentMap = new Map();
      const rootComments: any[] = [];

      // First pass: Create map of all comments
      data.comments.forEach((comment: any) => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      // Second pass: Build tree structure
      data.comments.forEach((comment: any) => {
        const commentWithReplies = commentMap.get(comment.id);

        if (comment.parentCommentId) {
          const parent = commentMap.get(comment.parentCommentId);
          if (parent) {
            parent.replies.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
        }
      });

      setComments(rootComments);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewComment = async (content: string, imageUrl?: string) => {
    try {
      await api.createComment({
        postId,
        content,
        imageUrl,
      });

      // Refresh comments
      await fetchComments();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to post comment');
    }
  };

  const handleReply = async (parentCommentId: string, content: string, imageUrl?: string) => {
    try {
      await api.createComment({
        postId,
        parentCommentId,
        content,
        imageUrl,
      });

      // Refresh comments
      await fetchComments();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to post reply');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>
        <button
          onClick={() => setSortBy('top')}
          className={`px-3 py-1 text-sm rounded ${
            sortBy === 'top'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Top
        </button>
        <button
          onClick={() => setSortBy('new')}
          className={`px-3 py-1 text-sm rounded ${
            sortBy === 'new'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          New
        </button>
        <button
          onClick={() => setSortBy('old')}
          className={`px-3 py-1 text-sm rounded ${
            sortBy === 'old'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Old
        </button>
      </div>

      {/* Comment form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <CommentForm postId={postId} onSubmit={handleNewComment} />
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading comments...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <Comment
                comment={comment}
                postId={postId}
                spaceName={spaceName}
                isModerator={isModerator}
                onReply={handleReply}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
