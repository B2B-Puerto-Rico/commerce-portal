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
  // Dual pricing
  const [dualPricingEnabled, setDualPricingEnabled] = useState((m.dual_pricing_enabled as boolean) || false);
  const [cardSurchargePct, setCardSurchargePct] = useState(String((m.card_surcharge_pct as number) || ''));
  const [allowCashOnFulfillment, setAllowCashOnFulfillment] = useState((m.allow_cash_on_fulfillment as boolean) !== false);
  const [dualPricingLabel, setDualPricingLabel] = useState((m.dual_pricing_label as string) || 'Card Service Fee');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
  const [section, setSection] = useState<'general' | 'appearance' | 'features' | 'integration'>('general');

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
        dual_pricing_enabled: dualPricingEnabled,
        card_surcharge_pct: dualPricingEnabled ? parseFloat(cardSurchargePct) || null : null,
        allow_cash_on_fulfillment: allowCashOnFulfillment,
        dual_pricing_label: dualPricingLabel || 'Card Service Fee',
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

  const sections = [
    { id: 'general' as const, label: 'General', icon: '⚙️' },
    { id: 'appearance' as const, label: 'Appearance', icon: '🎨' },
    { id: 'features' as const, label: 'Features', icon: '⚡' },
    { id: 'integration' as const, label: 'Integration', icon: '🔗' },
  ];

  return (
    <div className="max-w-3xl">
      {/* Section navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              section === s.id
                ? 'bg-cobalt text-white shadow-md'
                : 'bg-glass-surface text-glass-secondary hover:bg-glass-neutral border border-glass-border'
            }`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* ============================================= */}
      {/* GENERAL */}
      {/* ============================================= */}
      {section === 'general' && (
        <div className="space-y-6">
          {/* Cart Status — prominent card */}
          <div className={`rounded-2xl p-6 border-2 transition-colors ${
            cartEnabled ? 'bg-green-50/50 border-green-200' : 'bg-glass-neutral border-glass-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  cartEnabled ? 'bg-green-100' : 'bg-glass-neutral'
                }`}>
                  <svg className={`w-6 h-6 ${cartEnabled ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-glass-primary">Shopping Cart</h3>
                  <p className="text-xs text-glass-secondary mt-0.5">
                    {cartEnabled ? 'Cart is live — customers can place orders' : 'Cart is disabled — no orders accepted'}
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleCart}
                disabled={toggling}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  cartEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  cartEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Merchant Info */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Merchant Details
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-glass-secondary mb-1.5">Website URL</label>
                <input type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://merchant-name.b2bweb.app"
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-glass-secondary mb-1.5">GitHub Repository</label>
                <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="B2B-Puerto-Rico/merchant-name"
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-glass-secondary mb-1.5">Subscription Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'free', label: 'Free', desc: 'Basic cart' },
                    { id: 'pro', label: 'Pro', desc: 'Edit products' },
                    { id: 'premium', label: 'Premium', desc: 'Full access' },
                  ].map((t) => (
                    <button key={t.id} onClick={() => setTier(t.id)}
                      className={`p-3 rounded-[10px] border-2 text-center transition-all ${
                        tier === t.id ? 'border-cobalt bg-cobalt-50' : 'border-glass-border hover:border-glass-secondary'
                      }`}>
                      <p className={`text-sm font-bold ${tier === t.id ? 'text-cobalt' : 'text-glass-primary'}`}>{t.label}</p>
                      <p className="text-[10px] text-glass-secondary mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Invite Merchant */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Merchant
              </h3>
              <p className="text-xs text-glass-secondary mt-0.5">Create a login for the merchant to manage their own cart.</p>
            </div>
            <div className="p-6">
              {inviteResult ? (
                <div className="bg-green-50 rounded-[10px] p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Account created!
                  </p>
                  <div className="bg-white rounded-[10px] p-3 space-y-1 text-sm font-mono">
                    <p>Email: <strong>{inviteResult.email}</strong></p>
                    <p>Password: <strong>{inviteResult.password}</strong></p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="merchant@email.com"
                    className="flex-1 border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
                  <button onClick={handleInvite} disabled={inviting || !inviteEmail}
                    className="bg-cobalt text-white px-5 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-glass-border disabled:text-glass-secondary transition-all">
                    {inviting ? 'Creating...' : 'Invite'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* APPEARANCE */}
      {/* ============================================= */}
      {section === 'appearance' && (
        <div className="space-y-6">
          {/* Live Preview Banner */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Store Banner
              </h3>
              <p className="text-xs text-glass-secondary mt-0.5">Hero image at the top of your cart widget. 1200x400px recommended.</p>
            </div>
            <div className="p-6">
              <div
                className="relative border-2 border-dashed border-glass-border rounded-xl overflow-hidden hover:border-cobalt/30 transition-colors cursor-pointer group"
                onClick={() => document.getElementById('banner-upload')?.click()}
              >
                {bannerUrlState ? (
                  <div className="relative">
                    <img src={bannerUrlState} alt="" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-4 py-2 rounded-[10px]">Change Image</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 bg-glass-neutral rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-glass-secondary">Click to upload banner</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP up to 5MB</p>
                  </div>
                )}
                <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  fd.append('mid', mid);
                  const res = await fetch('/api/merchants/upload-banner', { method: 'POST', body: fd });
                  if (res.ok) { const data = await res.json(); setBannerUrlState(data.banner_url); }
                  e.target.value = '';
                }} />
              </div>
            </div>
          </div>

          {/* Button Customization */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Cart Button Style
              </h3>
            </div>
            <div className="p-6 space-y-5">
              {/* Live preview */}
              <div className="bg-glass-neutral rounded-xl p-6 text-center">
                <p className="text-[10px] font-bold text-glass-secondary uppercase tracking-widest mb-3">Preview</p>
                <button
                  style={{ backgroundColor: primaryColor }}
                  className="text-white px-8 py-3 rounded-2xl font-semibold text-sm shadow-lg transition-transform hover:scale-105"
                >
                  {buttonText || 'Order'} &middot; $24.99
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-glass-secondary mb-1.5">Button Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-[10px] border border-glass-border cursor-pointer" />
                    <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full border border-glass-border rounded-[10px] px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-glass-secondary mb-1.5">Button Text</label>
                  <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Order"
                    className="w-full border border-glass-border rounded-[10px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* FEATURES */}
      {/* ============================================= */}
      {section === 'features' && (
        <div className="space-y-6">
          {/* Pizzeria Mode */}
          <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
            pizzeriaMode ? 'border-orange-300 bg-orange-50/30' : 'border-glass-border bg-glass-surface'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    pizzeriaMode ? 'bg-orange-100' : 'bg-glass-neutral'
                  }`}>
                    🍕
                  </div>
                  <div>
                    <h3 className="font-semibold text-glass-primary">Pizza Builder</h3>
                    <p className="text-xs text-glass-secondary mt-0.5">Visual pizza customization with size, crust, toppings, half-pizza support</p>
                  </div>
                </div>
                <button onClick={() => setPizzeriaMode(!pizzeriaMode)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    pizzeriaMode ? 'bg-orange-500' : 'bg-gray-300'
                  }`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    pizzeriaMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {pizzeriaMode && (
                <div className="mt-4 pt-4 border-t border-orange-200">
                  <label className="block text-xs font-medium text-glass-secondary mb-1.5">Pizza Category Name</label>
                  <input type="text" value={pizzaCategoryName} onChange={(e) => setPizzaCategoryName(e.target.value)}
                    placeholder="Pizzas"
                    className="w-48 border border-orange-200 rounded-[10px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
                  <p className="text-xs text-glass-secondary mt-1.5">Products in this category will open the pizza builder.</p>
                </div>
              )}
            </div>
          </div>

          {/* Dual Pricing */}
          <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
            dualPricingEnabled ? 'border-cobalt/30 bg-cobalt-50/20' : 'border-glass-border bg-glass-surface'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    dualPricingEnabled ? 'bg-cobalt-50' : 'bg-glass-neutral'
                  }`}>
                    💳
                  </div>
                  <div>
                    <h3 className="font-semibold text-glass-primary">Dual Pricing</h3>
                    <p className="text-xs text-glass-secondary mt-0.5">Cash discount / card surcharge model</p>
                  </div>
                </div>
                <button onClick={() => setDualPricingEnabled(!dualPricingEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    dualPricingEnabled ? 'bg-cobalt' : 'bg-gray-300'
                  }`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    dualPricingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {dualPricingEnabled && (
                <div className="mt-5 pt-5 border-t border-cobalt/10 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-glass-secondary mb-1.5">Card Surcharge %</label>
                      <input type="number" step="0.01" min="0.01" max="19.99" value={cardSurchargePct}
                        onChange={(e) => setCardSurchargePct(e.target.value)}
                        placeholder="3.99"
                        className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
                      <p className="text-[10px] text-glass-secondary mt-1">e.g., 3.99% → $100 cash = $103.99 card</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-glass-secondary mb-1.5">Fee Label</label>
                      <input type="text" value={dualPricingLabel}
                        onChange={(e) => setDualPricingLabel(e.target.value)}
                        placeholder="Card Service Fee"
                        className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt transition-all" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-glass-neutral rounded-[10px]">
                    <div>
                      <span className="text-sm font-medium text-glass-primary">Allow cash on pickup/delivery</span>
                      <p className="text-[10px] text-glass-secondary mt-0.5">Customers can choose to pay cash at the counter</p>
                    </div>
                    <button onClick={() => setAllowCashOnFulfillment(!allowCashOnFulfillment)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        allowCashOnFulfillment ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowCashOnFulfillment ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  {/* Live preview */}
                  {cardSurchargePct && parseFloat(cardSurchargePct) > 0 && (
                    <div className="bg-glass-surface border border-glass-border rounded-[10px] p-4">
                      <p className="text-[10px] font-bold text-glass-secondary uppercase tracking-widest mb-2">Preview</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-glass-primary">$10.00 <span className="text-xs font-normal text-glass-secondary">cash</span></p>
                          <p className="text-sm font-bold text-cobalt">${(10 * (1 + parseFloat(cardSurchargePct) / 100)).toFixed(2)} <span className="text-xs font-normal">with card</span></p>
                        </div>
                        <span className="text-[10px] text-glass-secondary bg-glass-neutral px-2 py-1 rounded-full">{dualPricingLabel} ({cardSurchargePct}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Promo Codes */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Promo Codes
              </h3>
            </div>
            <div className="p-6">
              <PromoCodesManager mid={mid} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* INTEGRATION */}
      {/* ============================================= */}
      {section === 'integration' && (
        <div className="space-y-6">
          {/* Embed Code */}
          <div className="bg-glass-surface rounded-2xl border border-glass-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-glass-neutral/30">
              <h3 className="font-semibold text-sm text-glass-primary flex items-center gap-2">
                <svg className="w-4 h-4 text-glass-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Embed Code
              </h3>
              <p className="text-xs text-glass-secondary mt-0.5">Copy and paste into any website — WordPress, Shopify, HTML.</p>
            </div>
            <div className="p-6">
              <div className="relative">
                <pre className="bg-[#0F1419] text-cobalt-50 rounded-xl p-4 text-xs font-mono overflow-x-auto border border-white/10">
                  {embedCode}
                </pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-[10px] transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                  )}
                </button>
              </div>
              <a href={`https://commerce-cart-prod.b2bweb.app/widget?mid=${mid}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-cobalt hover:text-cobalt-600 font-medium">
                Preview cart widget
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Deploy to Merchant Site */}
          {githubRepo && (
            <div className="bg-[#0F1419] rounded-2xl p-6 text-white overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-cobalt/10 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-cobalt/10 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-cobalt rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Deploy to Website</h3>
                    <p className="text-xs text-white/50">{githubRepo}</p>
                  </div>
                </div>

                {deployResult ? (
                  <div className={`rounded-[10px] p-4 ${deployResult.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <p className="text-sm font-medium">{deployResult.message}</p>
                    {deployResult.url && (
                      <a href={deployResult.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-green-300 hover:text-green-100 mt-2 font-medium">
                        View on GitHub &rarr;
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setDeploying(true);
                      setDeployResult(null);
                      const res = await fetch('/api/merchants/deploy-cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mid }) });
                      const data = await res.json();
                      setDeployResult({ success: res.ok, message: data.message || data.error, url: data.issue_url });
                      setDeploying(false);
                    }}
                    disabled={deploying || !cartEnabled}
                    className="bg-cobalt text-white px-6 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    {deploying ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Deploying...</>
                    ) : (
                      <>Deploy Cart Widget</>
                    )}
                  </button>
                )}
                {!cartEnabled && <p className="text-xs text-yellow-300 mt-2">Enable the cart first.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================= */}
      {/* SAVE BAR — always visible */}
      {/* ============================================= */}
      <div className="sticky bottom-0 bg-glass-surface/80 backdrop-blur-lg border-t border-glass-border -mx-4 md:-mx-6 px-4 md:px-6 py-4 mt-8 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-cobalt text-white px-8 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-glass-border disabled:text-glass-secondary active:scale-[0.98] transition-all shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5 animate-in fade-in">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}
