'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MerchantSettingsPage() {
  const [mid, setMid] = useState('');
  const [merchant, setMerchant] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const merchantMid = user.app_metadata?.mid;
      if (!merchantMid) return;
      setMid(merchantMid);

      // Fetch merchant data via API to avoid RLS issues
      const res = await fetch(`/api/merchant-data?mid=${merchantMid}`);
      if (res.ok) {
        const data = await res.json();
        setMerchant(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  const theme = (merchant?.theme as Record<string, string>) || {};
  const embedCode = `<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${mid}" async></script>`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your online cart configuration</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Embed Code — front and center */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h2 className="font-bold text-base text-gray-900">Add Cart to Your Website</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Copy this one line of code and paste it into your website. Works on any platform — WordPress, Shopify, Squarespace, Wix, HTML, or Next.js.
          </p>

          <div className="relative">
            <pre className="bg-gray-950 text-green-400 rounded-xl p-5 text-sm font-mono overflow-x-auto leading-relaxed">
              {embedCode}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(embedCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
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
                  Copy Code
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex gap-4">
            <a
              href={`https://commerce-cart-prod.b2bweb.app/widget?mid=${mid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              Preview your cart
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Quick install guides */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Quick Install Guide</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>HTML:</strong> Paste the code before <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code> in your HTML file</p>
            <p><strong>WordPress:</strong> Use the &quot;Insert Headers and Footers&quot; plugin → paste in Footer</p>
            <p><strong>Shopify:</strong> Theme Editor → <code className="bg-gray-100 px-1 rounded text-xs">theme.liquid</code> → paste before <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code></p>
            <p><strong>Squarespace:</strong> Settings → Advanced → Code Injection → Footer</p>
            <p><strong>Wix:</strong> Settings → Custom Code → Body End</p>
          </div>
        </div>

        {/* Cart config */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Cart Appearance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Button color</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full border border-gray-200"
                  style={{ backgroundColor: theme.primaryColor || '#000' }}
                />
                <span className="text-xs text-gray-400 font-mono">{theme.primaryColor || '#000000'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Button text</span>
              <span className="text-sm text-gray-700">{theme.buttonText || 'Order'}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Contact your admin to customize the cart appearance.</p>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Account</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Merchant ID: <span className="font-mono text-gray-400">{mid}</span></p>
            <p>Business: <span className="font-medium">{merchant?.business_name as string}</span></p>
            <p>Cart status: <span className={`font-medium ${merchant?.cart_enabled ? 'text-green-600' : 'text-gray-400'}`}>{merchant?.cart_enabled ? 'Enabled' : 'Disabled'}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
