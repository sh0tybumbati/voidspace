'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ModActionsProps {
  type: 'post' | 'comment';
  targetId: string;
  authorUsername: string;
  spaceName: string;
  isModerator: boolean;
  isRemoved?: boolean;
  onActionComplete?: () => void;
}

export default function ModActions({
  type,
  targetId,
  authorUsername,
  spaceName,
  isModerator,
  isRemoved = false,
  onActionComplete,
}: ModActionsProps) {
  const router = useRouter();
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isModerator) return null;

  const handleRemove = async () => {
    if (removeReason.length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const endpoint = type === 'post' ? '/api/mod/remove-post' : '/api/mod/remove-comment';
      const payload =
        type === 'post'
          ? { postId: targetId, reason: removeReason }
          : { commentId: targetId, reason: removeReason };

      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      setShowRemoveModal(false);
      setRemoveReason('');
      if (onActionComplete) onActionComplete();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to remove content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBan = async () => {
    if (banReason.length < 10) {
      setError('Ban reason must be at least 10 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/mod/ban-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          username: authorUsername,
          spaceName,
          reason: banReason,
          duration: banDuration === '' ? undefined : Number(banDuration),
        }),
      });

      setShowBanModal(false);
      setBanReason('');
      setBanDuration('');
      if (onActionComplete) onActionComplete();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to ban user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Mod action buttons */}
      <div className="flex items-center gap-2">
        {!isRemoved && (
          <>
            <button
              onClick={() => setShowRemoveModal(true)}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
              title={`Remove ${type}`}
            >
              Remove
            </button>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <button
              onClick={() => setShowBanModal(true)}
              className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
              title="Ban user"
            >
              Ban User
            </button>
          </>
        )}
        {isRemoved && (
          <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
            [Removed by moderator]
          </span>
        )}
      </div>

      {/* Remove Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Remove {type === 'post' ? 'Post' : 'Comment'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This action will be logged publicly. You must provide a clear reason.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for removal <span className="text-red-500">*</span>
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Explain why this content violates the rules (min 10 characters)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                rows={4}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {removeReason.length}/10 minimum
              </p>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setRemoveReason('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                disabled={isLoading || removeReason.length < 10}
              >
                {isLoading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Ban User: {authorUsername}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This action will be logged publicly. The user will not be able to post or comment in
              this space.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for ban <span className="text-red-500">*</span>
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain why this user is being banned (min 10 characters)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                rows={3}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {banReason.length}/10 minimum
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (optional)
              </label>
              <input
                type="number"
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Leave empty for permanent ban"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min="1"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {banDuration === '' ? 'Permanent ban' : `${banDuration} day(s)`}
              </p>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason('');
                  setBanDuration('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
                disabled={isLoading || banReason.length < 10}
              >
                {isLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
