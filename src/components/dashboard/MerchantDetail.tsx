'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
}

type Tab = 'overview' | 'connect' | 'products' | 'orders' | 'sync' | 'settings';

export function MerchantDetail({ merchant, products, orders, syncRuns, categories }: Props) {
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
      <div className="flex gap-1 mb-6 border-b border-gray-100 -mx-6 px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
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
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Product</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Price</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Stock</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Visible</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Last Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.clover_item_id as string} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <span className="font-medium text-sm text-gray-900">{p.name as string}</span>
                    {p.sku ? <span className="block text-xs text-gray-400 mt-0.5">SKU: {p.sku as string}</span> : null}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-700">{formatPrice(p.price_cents as number)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${p.in_stock ? 'text-green-600' : 'text-red-500'}`}>
                      {p.in_stock ? (p.stock_count != null ? `${p.stock_count} left` : 'In stock') : 'Out of stock'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${!(p.hidden_online as boolean) && !(p.hidden_in_clover as boolean) ? 'text-green-600' : 'text-gray-400'}`}>
                      {!(p.hidden_online as boolean) && !(p.hidden_in_clover as boolean) ? 'Yes' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {p.last_synced_at ? new Date(p.last_synced_at as string).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                    <span className="text-xs font-mono text-gray-500">{(o.id as string).slice(0, 8)}</span>
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
        <div className="max-w-lg space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-1">Cart configuration</h3>
            <p className="text-xs text-gray-400 mb-4">Toggle the cart widget for this merchant&apos;s website.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Cart enabled</span>
                <button
                  onClick={handleToggleCart}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    cartEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cartEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Tier</span>
                <span className="text-sm font-medium text-gray-700 capitalize">{m.cart_tier as string}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Theme color</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full border border-gray-200"
                    style={{ backgroundColor: (m.theme as Record<string, string>)?.primaryColor || '#000' }}
                  />
                  <span className="text-xs text-gray-400 font-mono">
                    {(m.theme as Record<string, string>)?.primaryColor || '#000000'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Button text</span>
                <span className="text-sm text-gray-700">
                  {(m.theme as Record<string, string>)?.buttonText || 'Add to Cart'}
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* EMBED CODE — the money maker */}
          {/* ============================================================= */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h3 className="font-semibold text-sm text-gray-900">Embed Code</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Copy this one line and paste it into any website. Works on WordPress, Shopify, Squarespace, Wix, plain HTML — anywhere.
            </p>

            {/* The embed code */}
            <div className="relative group">
              <pre className="bg-gray-950 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                {`<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${m.mid}" async></script>`}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${m.mid}" async></script>`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Preview link */}
            <div className="mt-3 flex items-center gap-3">
              <a
                href={`https://commerce-cart-prod.b2bweb.app/widget?mid=${m.mid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview cart widget
              </a>
              <span className="text-gray-200">|</span>
              <a
                href={m.site_url as string || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                Visit merchant site
              </a>
            </div>
          </div>

          {/* Platform-specific instructions */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Installation guides</h3>
            <div className="space-y-3">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base">🌐</span> HTML / Any Website
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 pl-7 text-xs text-gray-500 space-y-1">
                  <p>Paste the embed code just before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag in your HTML file.</p>
                  <p>The cart button will appear automatically in the bottom-right corner.</p>
                </div>
              </details>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base">📝</span> WordPress
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 pl-7 text-xs text-gray-500 space-y-1">
                  <p><strong>Option 1:</strong> Install the &quot;Insert Headers and Footers&quot; plugin, then paste the embed code in the Footer section.</p>
                  <p><strong>Option 2:</strong> Go to Appearance → Theme Editor → footer.php, paste the code before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>.</p>
                </div>
              </details>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base">🛍️</span> Shopify
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 pl-7 text-xs text-gray-500 space-y-1">
                  <p>Go to Online Store → Themes → Edit code → <code className="bg-gray-100 px-1 rounded">theme.liquid</code></p>
                  <p>Paste the embed code just before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>.</p>
                </div>
              </details>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base">◼️</span> Squarespace / Wix
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 pl-7 text-xs text-gray-500 space-y-1">
                  <p><strong>Squarespace:</strong> Settings → Advanced → Code Injection → Footer, paste the embed code.</p>
                  <p><strong>Wix:</strong> Settings → Custom Code → Add Code → Body End, paste the embed code.</p>
                </div>
              </details>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base">⚛️</span> Next.js / React
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 pl-7 text-xs text-gray-500 space-y-2">
                  <p>Add to your root layout or any page using Next.js Script component:</p>
                  <pre className="bg-gray-50 rounded p-2 text-[11px] overflow-x-auto">{`import Script from 'next/script'

<Script
  src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${m.mid}"
  strategy="lazyOnload"
/>`}</pre>
                </div>
              </details>
            </div>
          </div>

          {/* Invite Merchant User */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-1">Invite Merchant</h3>
            <p className="text-xs text-gray-400 mb-4">
              Create a login for the merchant so they can manage their own products, orders, and cart settings.
            </p>

            {inviteResult ? (
              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-green-800">Merchant account created!</p>
                <p className="text-xs text-green-700">Share these credentials with the merchant:</p>
                <div className="bg-white rounded-lg p-3 space-y-1 text-sm font-mono">
                  <p>Email: <strong>{inviteResult.email}</strong></p>
                  <p>Password: <strong>{inviteResult.password}</strong></p>
                  <p className="text-xs text-gray-400 mt-2">Login URL: commerce-portal-prod.b2bweb.app/login</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Login: commerce-portal-prod.b2bweb.app/login\nEmail: ${inviteResult.email}\nPassword: ${inviteResult.password}`
                    );
                  }}
                  className="text-xs text-green-700 hover:text-green-900 font-medium"
                >
                  Copy credentials
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="merchant@email.com"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {inviting ? 'Creating...' : 'Invite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
