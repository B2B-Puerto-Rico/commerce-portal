'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'closed' | 'name' | 'mid' | 'environment' | 'creating';

export function AddMerchantForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('closed');
  const [name, setName] = useState('');
  const [mid, setMid] = useState('');
  const [environment, setEnvironment] = useState('sandbox');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setStep('creating');
    setError('');

    const res = await fetch('/api/merchants/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        business_name: name,
        region: 'na',
        environment,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/merchants/${mid}`);
      router.refresh();
    } else {
      setError(data.error || 'Failed to create merchant');
      setStep('environment');
    }
  };

  const reset = () => {
    setStep('closed');
    setName('');
    setMid('');
    setEnvironment('sandbox');
    setError('');
  };

  if (step === 'closed') {
    return (
      <button
        onClick={() => setStep('name')}
        className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Merchant
      </button>
    );
  }

  // Progress dots
  const steps: Step[] = ['name', 'mid', 'environment'];
  const currentIdx = steps.indexOf(step === 'creating' ? 'environment' : step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={reset}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-8 pt-8 pb-6 text-center relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

            <div className="relative">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-bold">New Merchant</h2>
              <p className="text-gray-400 text-sm mt-1">Set up a new business in 3 quick steps</p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mt-5">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i <= currentIdx
                      ? 'bg-white scale-100'
                      : 'bg-white/20 scale-75'
                  }`} />
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                      i < currentIdx ? 'bg-white/60' : 'bg-white/10'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Step 1: Business Name */}
            {step === 'name' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                    Business Name
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    The name customers will see on the cart
                  </p>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && name && setStep('mid')}
                    placeholder="e.g. Mar Azul Restaurant"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:ring-0 transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('mid')}
                    disabled={!name}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-300 active:scale-[0.98] transition-all"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Merchant ID */}
            {step === 'mid' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                    Merchant ID
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    From your payment processor (Clover MID or custom ID)
                  </p>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={mid}
                    onChange={(e) => setMid(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && mid && setStep('environment')}
                    placeholder="e.g. H0Y1154CXWA91"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base font-mono font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:ring-0 transition-colors"
                  />
                </div>

                {/* Preview card */}
                {name && mid && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Preview</p>
                    <p className="font-semibold text-sm text-gray-900">{name}</p>
                    <p className="text-xs text-gray-400 font-mono">{mid}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('name')}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('environment')}
                    disabled={!mid}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-300 active:scale-[0.98] transition-all"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Environment */}
            {step === 'environment' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                    Environment
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Choose sandbox for testing or production for live payments
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setEnvironment('sandbox')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        environment === 'sandbox'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span className="text-sm font-bold text-gray-900">Sandbox</span>
                      </div>
                      <p className="text-xs text-gray-500">Test with fake data</p>
                    </button>
                    <button
                      onClick={() => setEnvironment('production')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        environment === 'production'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span className="text-sm font-bold text-gray-900">Production</span>
                      </div>
                      <p className="text-xs text-gray-500">Live payments</p>
                    </button>
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ready to create</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Name</span>
                    <span className="text-sm font-semibold text-gray-900">{name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">MID</span>
                    <span className="text-sm font-mono text-gray-700">{mid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Environment</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      environment === 'production' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>{environment}</span>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('mid')}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
                  >
                    Create Merchant
                  </button>
                </div>
              </div>
            )}

            {/* Creating state */}
            {step === 'creating' && (
              <div className="py-8 text-center">
                <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-gray-900 mt-4">Creating {name}...</p>
                <p className="text-xs text-gray-400 mt-1">Setting up your merchant</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
