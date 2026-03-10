'use client';

import { useState, useEffect } from 'react';
import { AlignmentDisplay } from './AlignmentDisplay';

interface UserProfileProps {
  username: string;
}

interface UserData {
  id: string;
  username: string;
  createdAt: string;
  alignment: number;
  avatarUrl?: string;
  bio?: string;
}

export function UserProfile({ username }: UserProfileProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'about'>('posts');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${username}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load user');
        }

        setUser(data.user);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [username]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            {error || 'User not found'}
          </p>
        </div>
      </div>
    );
  }

  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center text-white text-3xl font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-grow">
            <h1 className="text-3xl font-bold mb-2">u/{user.username}</h1>

            <div className="flex flex-col gap-2 mb-4">
              <AlignmentDisplay alignment={user.alignment} size="md" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Joined {joinDate}
              </p>
            </div>

            {user.bio && (
              <p className="text-gray-700 dark:text-gray-300 mt-4">{user.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('posts')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'posts'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'comments'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Comments
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'about'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              About
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'posts' && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Posts will be displayed here (not yet implemented)
            </div>
          )}
          {activeTab === 'comments' && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Comments will be displayed here (not yet implemented)
            </div>
          )}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Username</h3>
                <p className="text-gray-700 dark:text-gray-300">u/{user.username}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Joined</h3>
                <p className="text-gray-700 dark:text-gray-300">{joinDate}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Alignment</h3>
                <AlignmentDisplay alignment={user.alignment} showLabel={false} size="lg" />
              </div>
              {user.bio && (
                <div>
                  <h3 className="font-semibold mb-1">Bio</h3>
                  <p className="text-gray-700 dark:text-gray-300">{user.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
