'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/cn';

/**
 * User-written markdown. Raw HTML is not allowed and the output is sanitised, so a post can never inject
 * script or styling. Links open in a new tab without leaking the referrer.
 */
export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose-void', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow ugc" />,
          img: ({ node: _node, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} alt={props.alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
