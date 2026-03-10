'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface ModAction {
  id: string;
  actionType: string;
  reason: string;
  details?: any;
  createdAt: string;
  mod: {
    username: string;
    avatarUrl?: string;
  };
  targetType?: string;
  targetId?: string;
}

export default function ModLogPage() {
  const params = useParams();
  const spaceName = params.name as string;

  const [modActions, setModActions] = useState<ModAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchModLog();
  }, [spaceName]);

  const fetchModLog = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/mod/${spaceName}/log`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch mod log');
      }

      const data = await response.json();
      setModActions(data.actions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load mod log');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionDescription = (action: ModAction) => {
    const modUsername = action.mod.username;

    switch (action.actionType) {
      case 'remove_post':
        return (
          <>
            <span className="font-semibold text-red-600 dark:text-red-400">Removed post</span> by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      case 'remove_comment':
        return (
          <>
            <span className="font-semibold text-red-600 dark:text-red-400">Removed comment</span> by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      case 'restore_post':
        return (
          <>
            <span className="font-semibold text-green-600 dark:text-green-400">Restored post</span> by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      case 'restore_comment':
        return (
          <>
            <span className="font-semibold text-green-600 dark:text-green-400">Restored comment</span> by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      case 'ban_user':
        const bannedUser = action.details?.username || 'Unknown user';
        const duration = action.details?.duration;
        return (
          <>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              Banned user u/{bannedUser}
            </span>{' '}
            {duration ? `for ${duration} day(s)` : '(permanent)'} by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      case 'unban_user':
        const unbannedUser = action.details?.username || 'Unknown user';
        return (
          <>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Unbanned user u/{unbannedUser}
            </span>{' '}
            by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold">{action.actionType}</span> by{' '}
            <Link href={`/u/${modUsername}`} className="font-semibold hover:underline">
              u/{modUsername}
            </Link>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href={`/v/${spaceName}`} className="hover:underline">
              v/{spaceName}
            </Link>
            <span>›</span>
            <span>Moderation Log</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Moderation Log
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            All moderation actions are public for transparency
          </p>
        </div>

        {/* Mod actions list */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading moderation log...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 dark:text-red-400">{error}</div>
        ) : modActions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No moderation actions yet in this space.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {modActions.map((action) => (
              <div
                key={action.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                      {getActionDescription(action)}
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 mb-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        Reason:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {action.reason}
                      </p>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
