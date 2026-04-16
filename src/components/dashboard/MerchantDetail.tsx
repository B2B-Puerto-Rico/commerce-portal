'use client';

import { useState } from 'react';
import Link from 'next/link';

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

type Tab = 'overview' | 'products' | 'orders' | 'sync' | 'settings';

export function MerchantDetail({ merchant, products, orders, syncRuns, categories }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const m = merchant;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
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
        <Link href="/dashboard/merchants" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          &larr; All merchants
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{m.business_name as string}</h1>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              m.cart_enabled
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${m.cart_enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            Cart {m.cart_enabled ? 'enabled' : 'disabled'}
          </span>
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
                <span className={`text-sm font-medium ${m.cart_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {m.cart_enabled ? 'Yes' : 'No'}
                </span>
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

          <p className="text-xs text-gray-400">
            Settings editing coming soon. For now, update directly in Supabase Dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
