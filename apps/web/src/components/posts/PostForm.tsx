'use client';

import { useState } from 'react';
import MarkdownEditor from '../ui/MarkdownEditor';

interface PostFormProps {
  spaceId: string;
  spaceName: string;
  onSubmit: (data: {
    title: string;
    content?: string;
    postType: 'text' | 'link' | 'image' | 'video';
    url?: string;
    isNsfw: boolean;
  }) => Promise<void>;
  cancelUrl?: string;
}

export default function PostForm({ spaceId, spaceName, onSubmit, cancelUrl }: PostFormProps) {
  const [postType, setPostType] = useState<'text' | 'link' | 'image' | 'video'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (title.length > 300) {
      setError('Title must be 300 characters or less');
      return;
    }

    if (postType !== 'text' && !url.trim()) {
      setError('URL is required for link, image, and video posts');
      return;
    }

    if (content.length > 40000) {
      setError('Content must be 40,000 characters or less');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim() || undefined,
        postType,
        url: url.trim() || undefined,
        isNsfw,
      });

      // Reset form
      setTitle('');
      setContent('');
      setUrl('');
      setIsNsfw(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Post type selector */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          type="button"
          onClick={() => setPostType('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            postType === 'text'
              ? 'bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v12H6V4z" clipRule="evenodd" />
          </svg>
          Text
        </button>

        <button
          type="button"
          onClick={() => setPostType('link')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            postType === 'link'
              ? 'bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
          </svg>
          Link
        </button>

        <button
          type="button"
          onClick={() => setPostType('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            postType === 'image'
              ? 'bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          Image
        </button>

        <button
          type="button"
          onClick={() => setPostType('video')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            postType === 'video'
              ? 'bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          Video
        </button>
      </div>

      {/* Title */}
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={300}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-gray-900 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 mt-1">{title.length}/300</p>
      </div>

      {/* URL for link/image/video posts */}
      {postType !== 'text' && (
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={`${postType.charAt(0).toUpperCase() + postType.slice(1)} URL`}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Content (optional for all types) */}
      <div>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Text (optional)"
          maxLength={40000}
          disabled={isSubmitting}
          minHeight="200px"
        />
      </div>

      {/* NSFW checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="nsfw"
          checked={isNsfw}
          onChange={(e) => setIsNsfw(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
          disabled={isSubmitting}
        />
        <label htmlFor="nsfw" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          Mark as NSFW (Not Safe For Work)
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>

        <a
          href={cancelUrl || `/v/${spaceName}`}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
        >
          Cancel
        </a>

        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          Posting to <span className="font-semibold text-gray-900 dark:text-gray-100">v/{spaceName}</span>
        </div>
      </div>

      {/* Posting guidelines */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Posting Guidelines
        </h3>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>Be respectful and follow community rules</li>
          <li>Use descriptive titles that accurately represent your post</li>
          <li>Mark NSFW content appropriately</li>
          <li>Do not post spam or self-promotion without permission</li>
        </ul>
      </div>
    </form>
  );
}
