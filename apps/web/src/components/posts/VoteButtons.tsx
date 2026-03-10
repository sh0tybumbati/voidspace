'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface VoteButtonsProps {
  targetId: string;
  targetType: 'post' | 'comment';
  initialVoteScore: number;
  initialUserVote: number | null;
  onVoteChange?: (newScore: number, newUserVote: number | null) => void;
}

export default function VoteButtons({
  targetId,
  targetType,
  initialVoteScore,
  initialUserVote,
  onVoteChange,
}: VoteButtonsProps) {
  const [voteScore, setVoteScore] = useState(initialVoteScore);
  const [userVote, setUserVote] = useState<number | null>(initialUserVote);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (voteValue: 1 | -1) => {
    if (isVoting) return;

    const token = api.getToken();
    if (!token) {
      alert('Please login to vote');
      return;
    }

    setIsVoting(true);

    try {
      let response;
      if (targetType === 'post') {
        response = await api.voteOnPost(targetId, voteValue);
      } else {
        response = await api.voteOnComment(targetId, voteValue);
      }

      const newScore = response.voteScore;

      // Determine new user vote based on response message
      let newUserVote: number | null = null;
      if (response.message === 'Vote added') {
        newUserVote = voteValue;
      } else if (response.message === 'Vote updated') {
        newUserVote = voteValue;
      } else if (response.message === 'Vote removed') {
        newUserVote = null;
      }

      setVoteScore(newScore);
      setUserVote(newUserVote);

      if (onVoteChange) {
        onVoteChange(newScore, newUserVote);
      }
    } catch (error: any) {
      console.error('Vote error:', error);
      alert(error.message || 'Failed to vote');
    } finally {
      setIsVoting(false);
    }
  };

  const getScoreColor = () => {
    if (voteScore > 0) return 'text-green-600';
    if (voteScore < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={isVoting}
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          userVote === 1 ? 'text-green-600' : 'text-gray-400'
        } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Upvote"
      >
        <svg
          className="w-6 h-6"
          fill={userVote === 1 ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      <span className={`text-sm font-semibold ${getScoreColor()}`}>
        {voteScore}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={isVoting}
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          userVote === -1 ? 'text-red-600' : 'text-gray-400'
        } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Downvote"
      >
        <svg
          className="w-6 h-6"
          fill={userVote === -1 ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}
