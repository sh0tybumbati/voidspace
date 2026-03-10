'use client';

import { useState } from 'react';
import MarkdownEditor from '../ui/MarkdownEditor';

interface CommentFormProps {
  postId: string;
  parentCommentId?: string;
  onSubmit: (content: string, imageUrl?: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
}

export default function CommentForm({
  postId,
  parentCommentId,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment...',
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    if (content.length > 10000) {
      setError('Comment is too long (max 10,000 characters)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(content, imageUrl.trim() || undefined);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder={placeholder}
        maxLength={10000}
        disabled={isSubmitting}
        minHeight="100px"
      />

      {/* Optional image URL input */}
      {showImageInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => {
              setShowImageInput(false);
              setImageUrl('');
            }}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            disabled={isSubmitting}
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isSubmitting ? 'Posting...' : 'Comment'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
        )}

        {!showImageInput && (
          <button
            type="button"
            onClick={() => setShowImageInput(true)}
            disabled={isSubmitting}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"
            title="Add image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Image
          </button>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {content.length}/10,000
        </span>
      </div>
    </form>
  );
}
