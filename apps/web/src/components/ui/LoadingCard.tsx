export default function LoadingCard() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="flex gap-4">
        {/* Vote skeleton */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-3">
          {/* Metadata */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>

          {/* Title */}
          <div className="w-3/4 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>

          {/* Content preview */}
          <div className="space-y-2">
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-5/6 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
