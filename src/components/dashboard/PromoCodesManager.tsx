'use client';

import { useState, useEffect } from 'react';

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_cents: number;
  max_uses: number | null;
  times_used: number;
  active: boolean;
  expires_at: string | null;
}

export function PromoCodesManager({ mid }: { mid: string }) {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'flat'>('percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');

  useEffect(() => {
    fetch('/api/merchants/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, action: 'list' }),
    }).then(r => r.json()).then(d => setPromos(d.promos || []));
  }, [mid]);

  const handleCreate = async () => {
    if (!code || !value) return;
    setSaving(true);
    const discountValue = type === 'percentage'
      ? parseInt(value)
      : Math.round(parseFloat(value) * 100);

    const res = await fetch('/api/merchants/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        action: 'create',
        code,
        discount_type: type,
        discount_value: discountValue,
        min_order_cents: minOrder ? Math.round(parseFloat(minOrder) * 100) : 0,
        max_uses: maxUses ? parseInt(maxUses) : null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPromos([data.promo, ...promos]);
      setCreating(false);
      setCode(''); setValue(''); setMinOrder(''); setMaxUses('');
    } else {
      alert(data.error || 'Failed to create');
    }
    setSaving(false);
  };

  const togglePromo = async (id: string, active: boolean) => {
    await fetch('/api/merchants/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, action: 'toggle', id, active }),
    });
    setPromos(promos.map(p => p.id === id ? { ...p, active } : p));
  };

  const deletePromo = async (id: string, promoCode: string) => {
    if (!confirm(`Delete promo code "${promoCode}"?`)) return;
    await fetch('/api/merchants/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, action: 'delete', id }),
    });
    setPromos(promos.filter(p => p.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Promo Codes</h3>
          <p className="text-xs text-gray-400 mt-0.5">Discount codes for customers at checkout</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold text-xs hover:bg-gray-800 active:scale-[0.98] transition-all"
          >
            + New Code
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PIZZA20"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'percentage' | 'flat')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="percentage">Percentage off</option>
                <option value="flat">Fixed amount off</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {type === 'percentage' ? 'Discount %' : 'Discount $'}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'percentage' ? '20' : '5.00'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min order $</label>
              <input
                type="number"
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max uses</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !code || !value}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-xs hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {saving ? 'Creating...' : 'Create Code'}
            </button>
            <button onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Promo codes list */}
      {promos.length === 0 && !creating ? (
        <p className="text-xs text-gray-400 text-center py-4">No promo codes yet</p>
      ) : (
        <div className="space-y-2">
          {promos.map((p) => (
            <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-gray-900">{p.code}</span>
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `$${(p.discount_value / 100).toFixed(2)} off`}
                </span>
                {p.min_order_cents > 0 && (
                  <span className="text-[10px] text-gray-400">min ${(p.min_order_cents / 100).toFixed(2)}</span>
                )}
                <span className="text-[10px] text-gray-400">
                  {p.times_used} used{p.max_uses ? ` / ${p.max_uses}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePromo(p.id, !p.active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <button onClick={() => deletePromo(p.id, p.code)} className="text-xs text-red-400 hover:text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
