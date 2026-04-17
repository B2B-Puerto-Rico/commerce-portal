'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MerchantSettingsPage() {
  const [mid, setMid] = useState('');
  const [merchant, setMerchant] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [buttonText, setButtonText] = useState('Order');
  const [bannerUrl, setBannerUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const merchantMid = user.app_metadata?.mid;
      if (!merchantMid) return;
      setMid(merchantMid);
      const res = await fetch(`/api/merchant-data?mid=${merchantMid}`);
      if (res.ok) {
        const data = await res.json();
        setMerchant(data);
        const theme = (data.theme || {}) as Record<string, string>;
        setPrimaryColor(theme.primaryColor || '#000000');
        setButtonText(theme.buttonText || 'Order');
        setBannerUrl(theme.bannerUrl || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/merchants/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        theme: { primaryColor, buttonText, bannerUrl: bannerUrl || undefined },
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const handleBannerUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mid', mid);
    const res = await fetch('/api/merchants/upload-banner', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setBannerUrl(data.banner_url);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  const tier = (merchant?.cart_tier as string) || 'free';
  const embedCode = `<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${mid}" async></script>`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Customize your online cart</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Banner Upload */}
        {(tier === 'pro' || tier === 'premium') && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-1">Store Banner</h3>
            <p className="text-xs text-gray-400 mb-3">Appears at the top of your cart widget. Recommended: 1200x400px.</p>
            <div
              className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('merchant-banner-upload')?.click()}
            >
              {bannerUrl ? (
                <div className="relative">
                  <img src={bannerUrl} alt="" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-sm font-medium opacity-0 hover:opacity-100">Click to replace</span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-400">Click to upload a banner image</p>
                </div>
              )}
              <input id="merchant-banner-upload" type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); e.target.value = ''; }}
              />
            </div>
          </div>
        )}

        {/* Cart Appearance */}
        {(tier === 'pro' || tier === 'premium') && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-4">Cart Appearance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Button Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)}
                  className="w-48 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleSave} disabled={saving}
                className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 active:scale-[0.98] transition-all">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            </div>
          </div>
        )}

        {tier === 'free' && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
            Upgrade to <strong>Pro</strong> to customize your cart appearance, upload banners, and edit products.
            Contact your admin to upgrade your tier.
          </div>
        )}

        {/* Embed Code */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h2 className="font-bold text-base text-gray-900">Add Cart to Your Website</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Copy and paste this one line into your website.
          </p>
          <div className="relative">
            <pre className="bg-gray-950 text-green-400 rounded-xl p-5 text-sm font-mono overflow-x-auto">{embedCode}</pre>
            <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <a href={`https://commerce-cart-prod.b2bweb.app/widget?mid=${mid}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium">
            Preview your cart
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Quick install */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Quick Install Guide</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>HTML:</strong> Paste before <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code></p>
            <p><strong>WordPress:</strong> Insert Headers and Footers plugin → Footer</p>
            <p><strong>Shopify:</strong> theme.liquid → before <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code></p>
            <p><strong>Squarespace:</strong> Settings → Code Injection → Footer</p>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Account</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Merchant ID: <span className="font-mono text-gray-400">{mid}</span></p>
            <p>Business: <span className="font-medium">{merchant?.business_name as string}</span></p>
            <p>Tier: <span className="font-medium capitalize">{tier}</span></p>
            <p>Cart: <span className={`font-medium ${merchant?.cart_enabled ? 'text-green-600' : 'text-gray-400'}`}>{merchant?.cart_enabled ? 'Enabled' : 'Disabled'}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
