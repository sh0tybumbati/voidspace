'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Process content to convert @username mentions to markdown links
function processUserMentions(content: string): string {
  // Match @username (alphanumeric, underscore, hyphen)
  // Don't match if already in a link or code block
  return content.replace(
    /(?<!`|]\()@([a-zA-Z0-9_-]+)(?!`|\))/g,
    '[@$1](/u/$1)'
  );
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const processedContent = processUserMentions(content);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Style headings
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 mt-6" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3 mt-5" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2 mt-4" {...props} />,

          // Style paragraphs
          p: ({ node, ...props }) => <p className="mb-3" {...props} />,

          // Style lists
          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 ml-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 ml-4" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,

          // Style links - use Next.js Link for internal links
          a: ({ node, href, ...props }) => {
            const isInternal = href && (href.startsWith('/') || href.startsWith('#'));

            if (isInternal) {
              return (
                <Link
                  href={href}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  {...props}
                />
              );
            }

            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            );
          },

          // Style code blocks
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400"
                {...props}
              />
            ) : (
              <code
                className="block bg-gray-100 dark:bg-gray-800 p-3 rounded my-2 overflow-x-auto text-sm font-mono"
                {...props}
              />
            ),

          // Style blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-3 text-gray-700 dark:text-gray-300"
              {...props}
            />
          ),

          // Style tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-300 dark:border-gray-600" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props} />
          ),

          // Style horizontal rules
          hr: ({ node, ...props }) => <hr className="my-4 border-gray-300 dark:border-gray-600" {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
