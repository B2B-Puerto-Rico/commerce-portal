'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AddMerchantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mid, setMid] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/merchants/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        business_name: name,
        region: 'na',
        environment: 'production',
      }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/merchants/${mid}`);
      router.refresh();
    } else {
      setError(data.error || 'Failed to create merchant');
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-gray-900 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
      >
        + Add Merchant
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-4 flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 mb-1">Merchant ID</label>
        <input
          type="text"
          required
          value={mid}
          onChange={(e) => setMid(e.target.value)}
          placeholder="ABCDE1234FGHI"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 mb-1">Business Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Merchant Name"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !mid || !name}
        className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
      >
        {loading ? 'Creating...' : 'Create'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-gray-400 hover:text-gray-600 px-2 py-2"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </form>
  );
}
