'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'closed' | 'company' | 'name' | 'mid' | 'environment' | 'creating';
type Company = 'b2b' | 'slice';

const COMPANIES: { id: Company; name: string; fullName: string; logo: string; gradient: string; ring: string; tagColor: string }[] = [
  {
    id: 'b2b',
    name: 'B2B',
    fullName: 'B2B Funding & Merchants',
    logo: '/b2b-logo.png',
    gradient: 'from-blue-600 to-blue-800',
    ring: 'ring-blue-400',
    tagColor: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'slice',
    name: 'Slice',
    fullName: 'Start Slice',
    logo: '/slice-logo.png',
    gradient: 'from-cyan-500 via-blue-500 to-orange-400',
    ring: 'ring-orange-400',
    tagColor: 'bg-orange-50 text-orange-700',
  },
];

export function AddMerchantForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('closed');
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [mid, setMid] = useState('');
  const [environment, setEnvironment] = useState('sandbox');
  const [error, setError] = useState('');

  const selectedCompany = COMPANIES.find((c) => c.id === company);

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
        company: company || 'b2b',
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
    setCompany(null);
    setName('');
    setMid('');
    setEnvironment('sandbox');
    setError('');
  };

  if (step === 'closed') {
    return (
      <button
        onClick={() => setStep('company')}
        className="bg-cobalt text-white px-5 py-2.5 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 active:scale-[0.98] transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Merchant
      </button>
    );
  }

  const allSteps: Step[] = ['company', 'name', 'mid', 'environment'];
  const currentIdx = allSteps.indexOf(step === 'creating' ? 'environment' : step);

  const headerGradient = selectedCompany
    ? `bg-gradient-to-br ${selectedCompany.gradient}`
    : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={reset}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md mx-4"
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className={`${headerGradient} px-8 pt-8 pb-6 text-center relative overflow-hidden transition-all duration-500`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

            <div className="relative">
              {selectedCompany ? (
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-2">
                  <img src={selectedCompany.logo} alt={selectedCompany.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
              <h2 className="text-white text-xl font-bold">
                {selectedCompany ? `${selectedCompany.name} Merchant` : 'New Merchant'}
              </h2>
              <p className="text-white/60 text-sm mt-1">
                {selectedCompany ? selectedCompany.fullName : 'Choose your company to get started'}
              </p>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mt-5">
              {allSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i <= currentIdx ? 'bg-white scale-100' : 'bg-white/20 scale-75'
                  }`} />
                  {i < allSteps.length - 1 && (
                    <div className={`w-6 h-0.5 rounded-full transition-all duration-300 ${
                      i < currentIdx ? 'bg-white/60' : 'bg-white/10'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Step 0: Company Selection */}
            {step === 'company' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                    Select Company
                  </label>
                  <p className="text-xs text-gray-400 mb-4">
                    Which company does this merchant belong to?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {COMPANIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setCompany(c.id); setStep('name'); }}
                        className={`group relative p-5 rounded-2xl border-2 text-center transition-all duration-200 hover:shadow-lg ${
                          company === c.id
                            ? `border-gray-900 bg-gray-50 shadow-md`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-white shadow-sm border border-gray-100 p-2 group-hover:scale-105 transition-transform">
                          <img src={c.logo} alt={c.name} className="w-full h-full object-contain" />
                        </div>
                        <p className="text-sm font-bold text-gray-900">{c.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{c.fullName}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

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
                    onClick={() => setStep('company')}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('mid')}
                    disabled={!name}
                    className="flex-1 bg-cobalt text-white py-3 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-gray-100 disabled:text-gray-300 active:scale-[0.98] transition-all"
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

                {name && mid && selectedCompany && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white shadow-sm border border-gray-100 p-1.5 flex-shrink-0">
                        <img src={selectedCompany.logo} alt="" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-mono">{mid}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedCompany.tagColor}`}>
                            {selectedCompany.name}
                          </span>
                        </div>
                      </div>
                    </div>
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
                    className="flex-1 bg-cobalt text-white py-3 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 disabled:bg-gray-100 disabled:text-gray-300 active:scale-[0.98] transition-all"
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
                        environment === 'sandbox' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
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
                        environment === 'production' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
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

                {/* Summary */}
                {selectedCompany && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ready to create</p>
                    <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                      <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-gray-100 p-1.5">
                        <img src={selectedCompany.logo} alt="" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">{name}</span>
                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedCompany.tagColor}`}>
                          {selectedCompany.name}
                        </span>
                      </div>
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
                )}

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
                    className="flex-1 bg-cobalt text-white py-3 rounded-[10px] font-semibold text-sm hover:bg-cobalt-600 active:scale-[0.98] transition-all"
                  >
                    Create Merchant
                  </button>
                </div>
              </div>
            )}

            {/* Creating */}
            {step === 'creating' && selectedCompany && (
              <div className="py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-gray-100 p-2 mx-auto mb-4 animate-pulse">
                  <img src={selectedCompany.logo} alt="" className="w-full h-full object-contain" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Creating {name}...</p>
                <p className="text-xs text-gray-400 mt-1">Setting up under {selectedCompany.fullName}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
