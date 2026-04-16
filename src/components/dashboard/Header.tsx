'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function Header({ email }: { email?: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6">
      {/* Mobile menu button placeholder */}
      <div className="md:hidden">
        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      <div className="hidden md:block" />

      {/* User info + sign out */}
      <div className="flex items-center gap-4">
        {email && (
          <span className="text-xs text-gray-400 hidden sm:block">{email}</span>
        )}
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
