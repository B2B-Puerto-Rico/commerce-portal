'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard/merchants');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-glass-neutral flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo + branding */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-glass-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <img src="/logo.png" alt="" className="w-9 h-9 rounded-lg" />
          </div>
          <h1 className="text-2xl font-semibold text-glass-primary tracking-tight">Commerce Portal</h1>
          <p className="text-sm text-glass-secondary mt-1.5">Sign in to manage your merchants</p>
        </div>

        {/* Login card */}
        <div className="bg-glass-surface rounded-2xl border border-glass-border p-7">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-glass-primary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@b2bpr.ai"
                className="w-full border border-glass-border rounded-[10px] px-4 py-3 text-base md:text-sm text-glass-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-glass-primary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-glass-border rounded-[10px] px-4 py-3 text-base md:text-sm text-glass-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-[10px]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-cobalt text-white py-3 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-glass-border disabled:text-glass-secondary disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-glass-secondary/50 mt-8 tracking-wide">
          B2B Commerce Platform
        </p>
      </div>
    </div>
  );
}
