'use client';

import { useState } from 'react';
import { PromoCodesManager } from './PromoCodesManager';

interface Props {
  mid: string;
  merchant: Record<string, unknown>;
  cartEnabled: boolean;
  onToggleCart: () => void;
  toggling: boolean;
  copied: boolean;
  setCopied: (v: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviting: boolean;
  inviteResult: { email: string; password: string } | null;
  handleInvite: () => void;
}

export function SettingsTab({
  mid, merchant: m, cartEnabled, onToggleCart, toggling,
  copied, setCopied, inviteEmail, setInviteEmail, inviting, inviteResult, handleInvite,
}: Props) {
  const theme = (m.theme as Record<string, string>) || {};

  const [bannerUrlState, setBannerUrlState] = useState(theme.bannerUrl || '');
  const [siteUrl, setSiteUrl] = useState((m.site_url as string) || '');
  const [githubRepo, setGithubRepo] = useState((m.github_repo as string) || '');
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor || '#000000');
  const [buttonText, setButtonText] = useState(theme.buttonText || 'Order');
  const [tier, setTier] = useState((m.cart_tier as string) || 'free');
  const [pizzeriaMode, setPizzeriaMode] = useState((theme as Record<string, unknown>).pizzeria_mode === true);
  const [pizzaCategoryName, setPizzaCategoryName] = useState(((theme as Record<string, unknown>).pizza_category_name as string) || 'Pizzas');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/merchants/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        site_url: siteUrl || null,
        github_repo: githubRepo || null,
        cart_tier: tier,
        theme: {
          primaryColor,
          buttonText,
          bannerUrl: bannerUrlState || undefined,
          pizzeria_mode: pizzeriaMode,
          pizza_category_name: pizzeriaMode ? pizzaCategoryName : undefined,
        },
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save');
    }
    setSaving(false);
  };

  const embedCode = `<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${mid}" async></script>`;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Merchant Details */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <h3 className="font-semibold text-sm text-glass-primary mb-4">Merchant Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-glass-secondary mb-1">Website URL</label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://merchant-name.b2bweb.app"
              className="w-full border border-glass-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-glass-secondary mb-1">GitHub Repository</label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="B2B-Puerto-Rico/merchant-name"
              className="w-full border border-glass-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cobalt"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-glass-secondary mb-1">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="border border-glass-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>
      </div>

      {/* Banner Image */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <h3 className="font-semibold text-sm text-glass-primary mb-1">Store Banner</h3>
        <p className="text-xs text-gray-400 mb-3">This image appears at the top of your cart widget. Recommended: 1200x400px.</p>
        <div
          className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => document.getElementById('banner-upload')?.click()}
        >
          {bannerUrlState ? (
            <div className="relative">
              <img src={bannerUrlState} alt="" className="w-full h-32 object-cover" />
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
          <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('mid', mid);
            const res = await fetch('/api/merchants/upload-banner', { method: 'POST', body: fd });
            if (res.ok) {
              const data = await res.json();
              setBannerUrlState(data.banner_url);
            }
            e.target.value = '';
          }} />
        </div>
      </div>

      {/* Cart Appearance */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <h3 className="font-semibold text-sm text-glass-primary mb-4">Cart Appearance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Cart enabled</span>
            <button
              onClick={onToggleCart}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                cartEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                cartEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-glass-secondary mb-1">Button Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-glass-border cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 border border-glass-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cobalt"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-glass-secondary mb-1">Button Text</label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Order"
              className="w-48 border border-glass-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt"
            />
          </div>
        </div>
      </div>

      {/* Pizzeria Mode */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
            <span className="text-lg">🍕</span>
            Pizzeria Mode
          </h3>
          <button
            onClick={() => setPizzeriaMode(!pizzeriaMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              pizzeriaMode ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              pizzeriaMode ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Activates a visual pizza builder for pizza products — customers can pick size, crust, sauce, toppings with half-pizza support.
        </p>
        {pizzeriaMode && (
          <div className="mt-3 pt-3 border-t border-glass-border">
            <label className="block text-xs font-medium text-glass-secondary mb-1">Pizza Category Name</label>
            <input
              type="text"
              value={pizzaCategoryName}
              onChange={(e) => setPizzaCategoryName(e.target.value)}
              placeholder="Pizzas"
              className="w-48 border border-glass-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Products in this category will open the pizza builder instead of the regular product detail.
            </p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-cobalt text-white px-6 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-glass-border active:scale-[0.98] transition-all"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        )}
      </div>

      {/* Promo Codes */}
      <PromoCodesManager mid={mid} />

      {/* Deploy to Merchant Site */}
      {githubRepo && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg" />
            <h3 className="font-bold text-base">Deploy Cart to Website</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Automatically add the cart widget to <strong>{githubRepo}</strong> via Claude Code.
            Creates a GitHub issue → Claude adds the script → PR created → auto-deploys on merge.
          </p>

          {deployResult ? (
            <div className={`rounded-lg p-4 ${deployResult.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <p className="text-sm font-medium">{deployResult.message}</p>
              {deployResult.url && (
                <a href={deployResult.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-300 hover:text-green-100 mt-2 font-medium">
                  View issue on GitHub
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={async () => {
                setDeploying(true);
                setDeployResult(null);
                const res = await fetch('/api/merchants/deploy-cart', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mid }),
                });
                const data = await res.json();
                setDeployResult({
                  success: res.ok,
                  message: data.message || data.error,
                  url: data.issue_url,
                });
                setDeploying(false);
              }}
              disabled={deploying || !cartEnabled}
              className="bg-white text-glass-primary px-6 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-glass-neutral disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center gap-2"
            >
              {deploying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent" />
                  Deploying...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Deploy Cart Widget
                </>
              )}
            </button>
          )}

          {!cartEnabled && (
            <p className="text-xs text-yellow-300 mt-2">Enable the cart first before deploying.</p>
          )}
        </div>
      )}

      {/* Embed Code */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-glass-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <h3 className="font-bold text-sm text-glass-primary">Embed Code</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Copy and paste into any website — WordPress, Shopify, HTML, anywhere.
        </p>
        <div className="relative">
          <pre className="bg-gray-950 text-green-400 rounded-xl p-4 text-xs font-mono overflow-x-auto">
            {embedCode}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(embedCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
            )}
          </button>
        </div>
        <a
          href={`https://commerce-cart-prod.b2bweb.app/widget?mid=${mid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-cobalt hover:text-cobalt-600 font-medium"
        >
          Preview cart widget
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Invite Merchant */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-6 shadow-sm">
        <h3 className="font-semibold text-sm text-glass-primary mb-1">Invite Merchant</h3>
        <p className="text-xs text-gray-400 mb-4">Create a login for the merchant to manage their own cart.</p>
        {inviteResult ? (
          <div className="bg-green-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">Account created!</p>
            <div className="bg-white rounded-lg p-3 space-y-1 text-sm font-mono">
              <p>Email: <strong>{inviteResult.email}</strong></p>
              <p>Password: <strong>{inviteResult.password}</strong></p>
              <p className="text-xs text-gray-400 mt-2">Login: commerce-portal-prod.b2bweb.app/login</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="merchant@email.com"
              className="flex-1 border border-glass-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="bg-cobalt text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-cobalt-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {inviting ? 'Creating...' : 'Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
