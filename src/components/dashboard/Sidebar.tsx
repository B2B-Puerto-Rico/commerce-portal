'use client';

import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Merchants',
    href: '/dashboard/merchants',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    href: '/dashboard/orders',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-[240px] md:flex-col md:fixed md:inset-y-0 bg-[#0F1419]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div>
          <span className="font-bold text-sm text-white">Commerce</span>
          <span className="text-[11px] text-white/40 block -mt-0.5">Admin Portal</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Navigation</p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-cobalt/10 text-cobalt border-l-2 border-cobalt ml-0'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
              }`}
            >
              <span className={isActive ? 'text-cobalt' : 'text-white/30'}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest">
          B2B Commerce Platform
        </p>
      </div>
    </aside>
  );
}
