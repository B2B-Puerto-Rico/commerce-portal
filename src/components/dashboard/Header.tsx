'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function Header({ email }: { email?: string }) {
  const router = useRouter();
  const initials = email ? email.slice(0, 2).toUpperCase() : 'AD';

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="h-14 md:h-16 border-b border-glass-border bg-glass-surface flex items-center justify-between px-4 md:px-6">
      {/* Mobile: show logo */}
      <div className="md:hidden flex items-center gap-2">
        <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg" />
        <span className="font-bold text-sm text-glass-primary">B2B Commerce</span>
      </div>

      {/* Desktop: empty */}
      <div className="hidden md:block" />

      {/* User info */}
      <div className="flex items-center gap-3">
        {email && (
          <span className="text-[11px] text-glass-secondary hidden sm:block truncate max-w-[200px]">{email}</span>
        )}
        <div className="w-8 h-8 rounded-full bg-cobalt/10 text-cobalt flex items-center justify-center text-[11px] font-bold">
          {initials}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-glass-secondary hover:text-glass-primary font-medium transition-colors px-3 py-1.5 rounded-[10px] hover:bg-glass-neutral"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
