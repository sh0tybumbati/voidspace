'use client';

interface AlignmentDisplayProps {
  alignment: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AlignmentDisplay({ alignment, showLabel = true, size = 'md' }: AlignmentDisplayProps) {
  // Determine color based on alignment score
  const getAlignmentColor = (score: number): string => {
    if (score > 100) return 'text-green-600 dark:text-green-400';
    if (score > 50) return 'text-green-500 dark:text-green-500';
    if (score > 0) return 'text-gray-600 dark:text-gray-400';
    if (score === 0) return 'text-gray-500 dark:text-gray-500';
    if (score >= -50) return 'text-orange-500 dark:text-orange-400';
    if (score >= -100) return 'text-red-500 dark:text-red-400';
    return 'text-red-600 dark:text-red-300';
  };

  const getAlignmentLabel = (score: number): string => {
    if (score > 1000) return 'Legendary';
    if (score > 500) return 'Excellent';
    if (score > 100) return 'Great';
    if (score > 50) return 'Good';
    if (score > 0) return 'Positive';
    if (score === 0) return 'Neutral';
    if (score >= -50) return 'Negative';
    if (score >= -100) return 'Poor';
    return 'Very Poor';
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
  };

  const colorClass = getAlignmentColor(alignment);
  const label = getAlignmentLabel(alignment);

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400">Alignment:</span>
      )}
      <span className={`${sizeClasses[size]} ${colorClass} font-medium`}>
        {alignment > 0 && '+'}
        {alignment}
      </span>
      <span className={`text-xs ${colorClass} uppercase tracking-wide`}>
        {label}
      </span>
    </div>
  );
}

export function AlignmentTooltip({ alignment }: { alignment: number }) {
  return (
    <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 max-w-xs">
      <p className="font-semibold mb-1">Alignment Score</p>
      <p className="text-gray-300 mb-2">
        Alignment is calculated from the total upvotes and downvotes on your posts and comments.
      </p>
      <p className="text-gray-300">
        Higher alignment shows positive community engagement. This score is used for mod election
        eligibility.
      </p>
    </div>
  );
}
