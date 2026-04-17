'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsTab } from './SettingsTab';
import { ProductsTab } from './ProductsTab';
import { MenuBuilder } from './MenuBuilder';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString();
}

interface Props {
  merchant: Record<string, unknown>;
  products: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  syncRuns: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  modifierGroups: Record<string, unknown>[];
  modifiers: Record<string, unknown>[];
}

type Tab = 'overview' | 'connect' | 'products' | 'menu' | 'orders' | 'sync' | 'settings';

export function MerchantDetail({ merchant, products, orders, syncRuns, categories, modifierGroups, modifiers }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [accessToken, setAccessToken] = useState('');
  const [ecommerceSk, setEcommerceSk] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [cartEnabled, setCartEnabled] = useState(merchant.cart_enabled as boolean);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; password: string } | null>(null);
  const router = useRouter();

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);
    const res = await fetch('/api/merchants/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid: m.mid, email: inviteEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteResult({ email: data.email, password: data.temp_password });
      setInviteEmail('');
    } else {
      alert(data.error || 'Failed to invite');
    }
    setInviting(false);
  };
  const m = merchant;

  const handleToggleCart = async () => {
    setToggling(true);
    const newVal = !cartEnabled;
    const res = await fetch('/api/merchants/toggle-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid: m.mid, cart_enabled: newVal }),
    });
    if (res.ok) {
      setCartEnabled(newVal);
    }
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${m.business_name}? This removes ALL products, orders, and sync data. This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch('/api/merchants/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid: m.mid }),
    });
    if (res.ok) {
      router.push('/dashboard/merchants');
      router.refresh();
    } else {
      setDeleting(false);
      alert('Failed to delete merchant');
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectMsg('');
    try {
      const res = await fetch('/api/merchants/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid: m.mid,
          access_token: accessToken,
          ecommerce_sk: ecommerceSk || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnectMsg('Clover connected successfully! Go to the Overview tab and click Sync Now.');
        setAccessToken('');
        setEcommerceSk('');
      } else {
        setConnectMsg(`Error: ${data.error}`);
      }
    } catch {
      setConnectMsg('Network error. Please try again.');
    }
    setConnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('Syncing... this may take a minute for large menus.');
    try {
      const res = await fetch('/api/merchants/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mid: m.mid }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`Sync complete! ${data.items_synced} items synced (${data.status}). Refresh the page to see products.`);
      } else {
        setSyncMsg(`Sync failed: ${data.error}`);
      }
    } catch {
      setSyncMsg('Network error during sync.');
    }
    setSyncing(false);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'connect', label: 'Connect Clover' },
    { id: 'products', label: 'Products', count: products.length },
    { id: 'menu', label: 'Menu Builder' },
    { id: 'orders', label: 'Orders', count: orders.length },
    { id: 'sync', label: 'Sync History', count: syncRuns.length },
    { id: 'settings', label: 'Settings' },
  ];

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-50 text-green-700';
      case 'pending': return 'bg-yellow-50 text-yellow-700';
      case 'failed': return 'bg-red-50 text-red-700';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const syncStatusColor = (s: string) => {
    switch (s) {
      case 'success': return 'bg-green-50 text-green-700';
      case 'running': return 'bg-blue-50 text-blue-700';
      case 'failed': return 'bg-red-50 text-red-700';
      default: return 'bg-yellow-50 text-yellow-700';
    }
  };

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <a href="/dashboard/merchants" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          &larr; All merchants
        </a>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{m.business_name as string}</h1>
            <button
              onClick={handleToggleCart}
              disabled={toggling}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors ${
                cartEnabled
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cartEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              {toggling ? 'Updating...' : cartEnabled ? 'Cart Enabled' : 'Cart Disabled'}
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            {deleting ? 'Deleting...' : 'Delete Merchant'}
          </button>
        </div>
        <p className="text-xs text-gray-400 font-mono mt-1">{m.mid as string}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs text-gray-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* Overview tab */}
      {/* ================================================================= */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Products</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{products.length}</p>
            <p className="text-xs text-gray-400 mt-1">{products.filter((p) => !(p.hidden_online as boolean)).length} visible in cart</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orders (30d)</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{orders.length}</p>
            <p className="text-xs text-gray-400 mt-1">{orders.filter((o) => o.status === 'paid').length} paid</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Sync</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {m.last_full_sync_at ? formatDate(m.last_full_sync_at as string) : 'Never'}
            </p>
            <p className="text-xs text-gray-400 mt-1">{syncRuns.length} total sync runs</p>
          </div>

          {/* Connection info */}
          <div className="md:col-span-3 bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Connection details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Region</p>
                <p className="font-medium text-gray-700 uppercase mt-0.5">{m.region as string}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Environment</p>
                <p className="font-medium text-gray-700 mt-0.5">{m.environment as string}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tier</p>
                <p className="font-medium text-gray-700 capitalize mt-0.5">{m.cart_tier as string}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Site</p>
                {m.site_url ? (
                  <a href={m.site_url as string} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline mt-0.5 block truncate">
                    {(m.site_url as string).replace('https://', '')}
                  </a>
                ) : (
                  <p className="text-gray-300 mt-0.5">Not set</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400">Clover Token</p>
                <p className="font-medium text-gray-700 mt-0.5">{m.clover_access_token ? 'Configured' : 'Not connected'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Webhook</p>
                <p className="font-medium text-gray-700 mt-0.5">{m.webhook_verified ? 'Verified' : 'Not verified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">GitHub Repo</p>
                <p className="font-medium text-gray-700 mt-0.5 truncate">{(m.github_repo as string) || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Categories</p>
                <p className="font-medium text-gray-700 mt-0.5">{categories.length}</p>
              </div>
            </div>
          {/* Business Hours */}
          <div className="md:col-span-3 bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Business Hours
              <span className="text-xs text-gray-400 font-normal">(synced from Clover)</span>
            </h3>
            {(() => {
              const hours = (m.theme as Record<string, unknown>)?.businessHours as { day: string; open: number; close: number }[] | undefined;
              if (!hours || !Array.isArray(hours) || hours.length === 0) {
                return (
                  <p className="text-xs text-gray-400">
                    No business hours synced yet. Set hours in your Clover merchant dashboard, then click Sync Now.
                  </p>
                );
              }
              const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
              const formatTime = (mins: number) => {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
              };
              const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
              const sorted = dayOrder.map(d => hours.find(h => h.day === d)).filter(Boolean) as (typeof hours[0] & { closed?: boolean })[];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {sorted.map((h) => {
                    const isClosed = h.closed || h.open === -1;
                    const isToday = h.day === today;
                    return (
                      <div
                        key={h.day}
                        className={`rounded-xl p-3 text-center ${
                          isToday
                            ? isClosed ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${
                          isToday ? (isClosed ? 'text-red-700' : 'text-green-700') : 'text-gray-400'
                        }`}>
                          {h.day.slice(0, 3)}
                        </p>
                        {isClosed ? (
                          <p className={`text-xs font-semibold mt-1.5 ${isToday ? 'text-red-600' : 'text-gray-400'}`}>Closed</p>
                        ) : (
                          <>
                            <p className={`text-xs font-semibold mt-1 ${isToday ? 'text-green-800' : 'text-gray-700'}`}>
                              {formatTime(h.open)}
                            </p>
                            <p className={`text-[11px] ${isToday ? 'text-green-600' : 'text-gray-400'}`}>
                              {formatTime(h.close)}
                            </p>
                          </>
                        )}
                        {isToday && (
                          <p className={`text-[9px] font-bold mt-0.5 ${isClosed ? 'text-red-600' : 'text-green-600'}`}>TODAY</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Sync Now button */}
          <div className="md:col-span-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            {syncMsg && (
              <p className={`mt-2 text-sm ${syncMsg.includes('complete') ? 'text-green-600' : syncMsg.includes('fail') ? 'text-red-600' : 'text-blue-600'}`}>
                {syncMsg}
              </p>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Connect Clover tab */}
      {/* ================================================================= */}
      {tab === 'connect' && (
        <div className="max-w-lg space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-1">Connect Clover Account</h3>
            <p className="text-xs text-gray-400 mb-4">
              Paste the Clover API credentials for this merchant. Tokens are encrypted at rest using Supabase Vault.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste Clover access token"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">
                  From Clover Developer Dashboard → Your App → API Tokens
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ecommerce Private Key (optional)
                </label>
                <input
                  type="password"
                  value={ecommerceSk}
                  onChange={(e) => setEcommerceSk(e.target.value)}
                  placeholder="sk_... (for Hosted Checkout)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Only needed for payment processing. Can add later.
                </p>
              </div>

              {connectMsg && (
                <p className={`text-sm p-3 rounded-lg ${connectMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {connectMsg}
                </p>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting || !accessToken}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                {connecting ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-semibold text-sm text-blue-900">How to get your Clover API token:</h4>
            <ol className="mt-2 text-xs text-blue-800 space-y-1 list-decimal ml-4">
              <li>Go to the Clover Developer Dashboard</li>
              <li>Select your app → API Tokens</li>
              <li>Create a test API token for this merchant</li>
              <li>Copy and paste it above</li>
            </ol>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Products tab */}
      {/* ================================================================= */}
      {tab === 'products' && (
        <ProductsTab
          mid={m.mid as string}
          tier={m.cart_tier as string}
          products={products as unknown as { clover_item_id: string; name: string; price_cents: number; description: string | null; image_url: string | null; sku: string | null; in_stock: boolean; hidden_online: boolean; hidden_in_clover: boolean; last_synced_at: string | null }[]}
          categories={categories as unknown as { clover_category_id: string; name: string }[]}
        />
      )}

      {/* ================================================================= */}
      {/* Menu Builder tab */}
      {/* ================================================================= */}
      {tab === 'menu' && (
        <MenuBuilder
          mid={m.mid as string}
          tier={m.cart_tier as string}
          categories={categories as unknown as { clover_category_id: string; name: string; sort_order: number }[]}
          modifierGroups={modifierGroups as unknown as { clover_mg_id: string; name: string; min_required: number; max_allowed: number }[]}
          modifiers={modifiers as unknown as { clover_modifier_id: string; clover_mg_id: string; name: string; price_cents: number; available: boolean }[]}
        />
      )}

      {/* ================================================================= */}
      {/* Orders tab */}
      {/* ================================================================= */}
      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Order</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Total</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">No orders yet</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id as string} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    {(o.clover_order_id as string) ? (
                      <a
                        href={`${(m.environment as string) === 'sandbox' ? 'https://sandbox.dev.clover.com' : 'https://www.clover.com'}/merchants/${m.mid}/orders/${o.clover_order_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        #{o.clover_order_id as string}
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-gray-400">{(o.id as string).slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-gray-900">{o.customer_name as string}</span>
                    <span className="block text-xs text-gray-400">{o.customer_email as string}</span>
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">{formatPrice(o.total_cents as number)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(o.status as string)}`}>
                      {o.status as string}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{formatDate(o.created_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================================= */}
      {/* Sync tab */}
      {/* ================================================================= */}
      {tab === 'sync' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Trigger</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Scope</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Items</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {syncRuns.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">No sync runs yet</td></tr>
              ) : syncRuns.map((s) => (
                <tr key={s.id as string} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm text-gray-700 capitalize">{s.trigger as string}</td>
                  <td className="px-5 py-3 text-sm text-gray-700 capitalize">{s.scope as string}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${syncStatusColor(s.status as string)}`}>
                      {s.status as string}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{s.items_synced as number}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{formatDate(s.started_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================================= */}
      {/* Settings tab */}
      {/* ================================================================= */}
      {tab === 'settings' && (
        <SettingsTab mid={m.mid as string} merchant={m} cartEnabled={cartEnabled} onToggleCart={handleToggleCart} toggling={toggling} copied={copied} setCopied={setCopied} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviting={inviting} inviteResult={inviteResult} handleInvite={handleInvite} />
      )}
    </div>
  );
}
