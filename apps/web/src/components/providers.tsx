'use client';

import { AuthProvider } from '@/lib/auth-context';
import { LiveProvider } from '@/lib/live';
import { ThemeProvider } from '@/lib/theme-context';
import { Toaster } from '@/components/ui/Toast';
import { AppShell } from '@/components/layout/AppShell';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LiveProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </LiveProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
