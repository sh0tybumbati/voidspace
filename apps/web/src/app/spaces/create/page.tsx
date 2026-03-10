'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';

const createSpaceSchema = z.object({
  name: z
    .string()
    .min(3, 'Space name must be at least 3 characters')
    .max(50, 'Space name must be less than 50 characters')
    .regex(/^[a-z0-9_]+$/, 'Space name can only contain lowercase letters, numbers, and underscores')
    .refine((name) => name === name.toLowerCase(), 'Space name must be lowercase'),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  isNsfw: z.boolean().default(false),
  nsfwType: z.enum(['none', 'partial', 'full']).default('none'),
});

type CreateSpaceFormData = z.infer<typeof createSpaceSchema>;

export default function CreateSpacePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateSpaceFormData>({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: {
      isNsfw: false,
      nsfwType: 'none',
    },
  });

  const isNsfw = watch('isNsfw');

  // Redirect if not logged in
  if (!user) {
    router.push('/login?redirect=/spaces/create');
    return null;
  }

  const onSubmit = async (data: CreateSpaceFormData) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await api.createSpace({
        name: data.name,
        displayName: data.displayName,
        description: data.description || '',
        isNsfw: data.isNsfw,
        nsfwType: data.isNsfw ? data.nsfwType : 'none',
      }) as { message: string; space: { name: string } };

      console.log('Space created:', response.space.name);

      // Redirect to the new space
      router.push(`/v/${response.space.name}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-background-secondary border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Create a Space</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Space Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Space Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="text-foreground-secondary mr-1">v/</span>
                <input
                  {...register('name')}
                  id="name"
                  type="text"
                  placeholder="my_awesome_space"
                  className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-secondary text-foreground placeholder-foreground-secondary/50"
                />
              </div>
              <p className="mt-1 text-sm text-foreground-secondary">
                Lowercase letters, numbers, and underscores only. This cannot be changed later.
              </p>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('displayName')}
                id="displayName"
                type="text"
                placeholder="My Awesome Space"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-secondary text-foreground placeholder-foreground-secondary/50"
              />
              <p className="mt-1 text-sm text-foreground-secondary">
                This is the friendly name that will be displayed throughout the site.
              </p>
              {errors.displayName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.displayName.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={4}
                placeholder="What is this space about?"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-secondary text-foreground placeholder-foreground-secondary/50 resize-none"
              />
              <p className="mt-1 text-sm text-foreground-secondary">
                A brief description of your space (optional, max 500 characters)
              </p>
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* NSFW Settings */}
            <div className="border border-border rounded-lg p-4 bg-background">
              <div className="flex items-start">
                <input
                  {...register('isNsfw')}
                  id="isNsfw"
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-border rounded"
                />
                <div className="ml-3">
                  <label htmlFor="isNsfw" className="text-sm font-medium text-foreground">
                    This space contains NSFW content (18+)
                  </label>
                  <p className="text-sm text-foreground-secondary mt-1">
                    If your space will contain adult content, enable this option.
                  </p>
                </div>
              </div>

              {isNsfw && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    NSFW Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start">
                      <input
                        {...register('nsfwType')}
                        type="radio"
                        value="partial"
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-border"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-foreground">Partial</span>
                        <p className="text-sm text-foreground-secondary">
                          Some posts may contain NSFW content (must be tagged)
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start">
                      <input
                        {...register('nsfwType')}
                        type="radio"
                        value="full"
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-border"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-foreground">Full</span>
                        <p className="text-sm text-foreground-secondary">
                          Entire space is 18+ (all content assumed NSFW)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isLoading ? 'Creating Space...' : 'Create Space'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-border text-foreground rounded-lg hover:bg-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Guidelines */}
        <div className="mt-8 bg-background-secondary border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Community Guidelines</h2>
          <ul className="space-y-2 text-sm text-foreground-secondary">
            <li>• Choose a descriptive name that represents your community</li>
            <li>• Space names cannot be changed after creation</li>
            <li>• You will automatically become the founder moderator</li>
            <li>• Follow Voidspace's content policy and legal requirements</li>
            <li>• NSFW spaces must be properly marked for age-gating</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
