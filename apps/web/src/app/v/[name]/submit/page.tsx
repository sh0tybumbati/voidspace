'use client';

import { useParams } from 'next/navigation';
import PostComposer from '@/components/posts/PostComposer';

export default function SpaceSubmitPage() {
  const { name } = useParams<{ name: string }>();
  return <PostComposer spaceName={name} />;
}
