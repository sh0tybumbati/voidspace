'use client';

import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content...',
  maxLength = 10000,
  disabled = false,
  minHeight = '150px',
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-2">
      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !showPreview
              ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            showPreview
              ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Editor or Preview */}
      {showPreview ? (
        <div
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-auto"
          style={{ minHeight }}
        >
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-gray-900 dark:text-gray-100 dark:bg-gray-800"
          style={{ minHeight }}
        />
      )}

      {/* Character count and markdown hint */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>Markdown supported</span>
          <a
            href="https://www.markdownguide.org/basic-syntax/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Learn more
          </a>
        </div>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
