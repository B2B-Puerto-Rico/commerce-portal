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
    <header className="h-14 md:h-16 border-b border-gray-100 bg-white flex items-center justify-between px-4 md:px-6">
      {/* Mobile: show logo */}
      <div className="md:hidden flex items-center gap-2">
        <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg" />
        <span className="font-bold text-sm text-gray-900">B2B Commerce</span>
      </div>

      {/* Desktop: empty space (sidebar handles nav) */}
      <div className="hidden md:block" />

      {/* User info + sign out */}
      <div className="flex items-center gap-3">
        {email && (
          <span className="text-[11px] text-gray-400 hidden sm:block truncate max-w-[200px]">{email}</span>
        )}
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
