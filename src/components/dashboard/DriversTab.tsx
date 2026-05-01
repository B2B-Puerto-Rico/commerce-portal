'use client';

import { useState, useEffect } from 'react';

interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  pay_type: string;
  pay_rate_cents: number;
  zone_ids: string[];
  status: string;
  email_verified: boolean;
  total_deliveries: number;
  total_tips_cents: number;
  avg_delivery_mins: number;
  late_count_30d: number;
  created_at: string;
}

interface Zone {
  id: string;
  name: string;
  zip_codes: string[];
  color: string;
}

interface DeliveryConfig {
  delivery_enabled: boolean;
  delivery_radius_miles: number;
  store_address: string | null;
  store_latitude: number | null;
  store_longitude: number | null;
  delivery_fee_cents: number;
  estimated_prep_mins: number;
  tipping_enabled: boolean;
  min_order_cents: number;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function DriversTab({ mid }: { mid: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'drivers' | 'zones' | 'settings'>('drivers');

  // Add driver form
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ full_name: '', email: '', phone: '', pay_type: 'per_delivery', pay_rate: '', zone_ids: [] as string[] });
  const [addingDriver, setAddingDriver] = useState(false);
  const [addDriverMsg, setAddDriverMsg] = useState('');

  // Add zone form
  const [showAddZone, setShowAddZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', zip_codes: '', color: '#3B82F6' });
  const [addingZone, setAddingZone] = useState(false);

  // Config form
  const [configForm, setConfigForm] = useState<DeliveryConfig>({
    delivery_enabled: false, delivery_radius_miles: 10, store_address: '', store_latitude: null, store_longitude: null,
    delivery_fee_cents: 0, estimated_prep_mins: 20, tipping_enabled: true, min_order_cents: 0,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  async function loadAll() {
    setLoading(true);
    const [driversRes, zonesRes, configRes] = await Promise.all([
      fetch(`/api/merchants/drivers?mid=${mid}`),
      fetch(`/api/merchants/delivery-zones?mid=${mid}`),
      fetch(`/api/merchants/delivery-config?mid=${mid}`),
    ]);
    setDrivers(await driversRes.json());
    setZones(await zonesRes.json());
    const cfg = await configRes.json();
    setConfigForm({
      delivery_enabled: cfg.delivery_enabled || false,
      delivery_radius_miles: cfg.delivery_radius_miles || 10,
      store_address: cfg.store_address || '',
      store_latitude: cfg.store_latitude || null,
      store_longitude: cfg.store_longitude || null,
      delivery_fee_cents: cfg.delivery_fee_cents || 0,
      estimated_prep_mins: cfg.estimated_prep_mins || 20,
      tipping_enabled: cfg.tipping_enabled !== false,
      min_order_cents: cfg.min_order_cents || 0,
    });
    setLoading(false);
  }

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    setAddingDriver(true);
    setAddDriverMsg('');
    const res = await fetch('/api/merchants/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        full_name: driverForm.full_name,
        email: driverForm.email,
        phone: driverForm.phone,
        pay_type: driverForm.pay_type,
        pay_rate_cents: Math.round(parseFloat(driverForm.pay_rate || '0') * 100),
        zone_ids: driverForm.zone_ids,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddDriverMsg('Driver added! Verification email sent.');
      setDriverForm({ full_name: '', email: '', phone: '', pay_type: 'per_delivery', pay_rate: '', zone_ids: [] });
      setShowAddDriver(false);
      loadAll();
    } else {
      setAddDriverMsg(`Error: ${data.error}`);
    }
    setAddingDriver(false);
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    setAddingZone(true);
    await fetch('/api/merchants/delivery-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        name: zoneForm.name,
        zip_codes: zoneForm.zip_codes.split(',').map((z) => z.trim()).filter(Boolean),
        color: zoneForm.color,
      }),
    });
    setZoneForm({ name: '', zip_codes: '', color: '#3B82F6' });
    setShowAddZone(false);
    loadAll();
    setAddingZone(false);
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    setConfigSaved(false);
    await fetch('/api/merchants/delivery-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, ...configForm }),
    });
    setSavingConfig(false);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  }

  async function handleDeleteDriver(id: string) {
    if (!confirm('Remove this driver?')) return;
    await fetch(`/api/merchants/drivers?id=${id}&mid=${mid}`, { method: 'DELETE' });
    loadAll();
  }

  async function handleToggleDriverStatus(driver: Driver) {
    const newStatus = driver.status === 'active' ? 'inactive' : 'active';
    await fetch('/api/merchants/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, id: driver.id, status: newStatus }),
    });
    loadAll();
  }

  async function handleDeleteZone(id: string) {
    if (!confirm('Delete this zone?')) return;
    await fetch(`/api/merchants/delivery-zones?id=${id}&mid=${mid}`, { method: 'DELETE' });
    loadAll();
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading delivery settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'drivers' as const, label: 'Drivers', count: drivers.length },
          { id: 'zones' as const, label: 'Zones', count: zones.length },
          { id: 'settings' as const, label: 'Delivery Settings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              view === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {'count' in tab && tab.count !== undefined && <span className="ml-1.5 text-gray-300">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ============================================= */}
      {/* DRIVERS LIST */}
      {/* ============================================= */}
      {view === 'drivers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">Delivery Drivers</h3>
            <button
              onClick={() => setShowAddDriver(!showAddDriver)}
              className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              + Add Driver
            </button>
          </div>

          {addDriverMsg && (
            <p className={`text-sm p-3 rounded-lg ${addDriverMsg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {addDriverMsg}
            </p>
          )}

          {/* Add driver form */}
          {showAddDriver && (
            <form onSubmit={handleAddDriver} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h4 className="font-semibold text-sm text-gray-900">New Driver</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
                  <input required value={driverForm.full_name} onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                  <input required type="email" value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone *</label>
                  <input required type="tel" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pay Type</label>
                  <select value={driverForm.pay_type} onChange={(e) => setDriverForm({ ...driverForm, pay_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="per_delivery">Per Delivery</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rate ($)</label>
                  <input type="number" step="0.01" value={driverForm.pay_rate} onChange={(e) => setDriverForm({ ...driverForm, pay_rate: e.target.value })}
                    placeholder="5.00" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assign Zones</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {zones.map((z) => (
                      <button key={z.id} type="button"
                        onClick={() => setDriverForm({
                          ...driverForm,
                          zone_ids: driverForm.zone_ids.includes(z.id)
                            ? driverForm.zone_ids.filter((id) => id !== z.id)
                            : [...driverForm.zone_ids, z.id],
                        })}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all ${
                          driverForm.zone_ids.includes(z.id) ? 'text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                        style={driverForm.zone_ids.includes(z.id) ? { backgroundColor: z.color } : undefined}
                      >
                        {z.name}
                      </button>
                    ))}
                    {zones.length === 0 && <span className="text-xs text-gray-400">Create zones first</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={addingDriver}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-800 disabled:bg-gray-300">
                  {addingDriver ? 'Adding...' : 'Add Driver & Send Invite'}
                </button>
                <button type="button" onClick={() => setShowAddDriver(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3">Cancel</button>
              </div>
            </form>
          )}

          {/* Driver list */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {drivers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No drivers yet. Add your first driver above.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {drivers.map((driver) => (
                  <div key={driver.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                        {driver.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{driver.full_name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            driver.status === 'active' ? 'bg-green-50 text-green-700' :
                            driver.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {driver.status}
                          </span>
                          {!driver.email_verified && (
                            <span className="text-[10px] text-amber-600 font-medium">Email not verified</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          <span>{driver.email}</span>
                          <span>{driver.phone}</span>
                          <span>{driver.pay_type === 'hourly' ? `${formatPrice(driver.pay_rate_cents)}/hr` : `${formatPrice(driver.pay_rate_cents)}/delivery`}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Stats */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400">{driver.total_deliveries} deliveries</p>
                        <p className="text-xs text-gray-400">Tips: {formatPrice(driver.total_tips_cents)}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleToggleDriverStatus(driver)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${
                            driver.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}>
                          {driver.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteDriver(driver.id)}
                          className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* ZONES */}
      {/* ============================================= */}
      {view === 'zones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">Delivery Zones</h3>
            <button onClick={() => setShowAddZone(!showAddZone)}
              className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-800">
              + Add Zone
            </button>
          </div>

          {showAddZone && (
            <form onSubmit={handleAddZone} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Zone Name *</label>
                  <input required value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                    placeholder="Zone A" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Zip Codes (comma separated)</label>
                  <input value={zoneForm.zip_codes} onChange={(e) => setZoneForm({ ...zoneForm, zip_codes: e.target.value })}
                    placeholder="00901, 00902, 00907" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                  <input type="color" value={zoneForm.color} onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={addingZone}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-800 disabled:bg-gray-300">
                  {addingZone ? 'Adding...' : 'Create Zone'}
                </button>
                <button type="button" onClick={() => setShowAddZone(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {zones.map((zone) => {
              const assignedDrivers = drivers.filter((d) => d.zone_ids.includes(zone.id));
              return (
                <div key={zone.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                      <span className="text-sm font-bold text-gray-900">{zone.name}</span>
                    </div>
                    <button onClick={() => handleDeleteZone(zone.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {zone.zip_codes.map((zip) => (
                      <span key={zip} className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{zip}</span>
                    ))}
                    {zone.zip_codes.length === 0 && <span className="text-xs text-gray-400">No zip codes</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {assignedDrivers.length} driver{assignedDrivers.length !== 1 ? 's' : ''}: {assignedDrivers.map((d) => d.full_name).join(', ') || 'None'}
                  </p>
                </div>
              );
            })}
            {zones.length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-400 text-sm">No zones yet. Create zones to organize delivery areas.</div>
            )}
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* SETTINGS */}
      {/* ============================================= */}
      {view === 'settings' && (
        <div className="max-w-lg space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Delivery Settings</h3>
              <button onClick={() => setConfigForm({ ...configForm, delivery_enabled: !configForm.delivery_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configForm.delivery_enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  configForm.delivery_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Store Address</label>
              <input value={configForm.store_address || ''} onChange={(e) => setConfigForm({ ...configForm, store_address: e.target.value })}
                placeholder="123 Main St, San Juan, PR 00901"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <p className="text-xs text-gray-400 mt-1">Used to calculate distance to delivery addresses</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Radius (miles)</label>
                <input type="number" step="0.5" value={configForm.delivery_radius_miles}
                  onChange={(e) => setConfigForm({ ...configForm, delivery_radius_miles: parseFloat(e.target.value) || 10 })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Fee ($)</label>
                <input type="number" step="0.01" value={(configForm.delivery_fee_cents / 100).toFixed(2)}
                  onChange={(e) => setConfigForm({ ...configForm, delivery_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Prep Time (minutes)</label>
                <input type="number" value={configForm.estimated_prep_mins}
                  onChange={(e) => setConfigForm({ ...configForm, estimated_prep_mins: parseInt(e.target.value) || 20 })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Order ($)</label>
                <input type="number" step="0.01" value={(configForm.min_order_cents / 100).toFixed(2)}
                  onChange={(e) => setConfigForm({ ...configForm, min_order_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={configForm.tipping_enabled}
                onChange={(e) => setConfigForm({ ...configForm, tipping_enabled: e.target.checked })}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
              Enable tipping at checkout
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSaveConfig} disabled={savingConfig}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300">
              {savingConfig ? 'Saving...' : 'Save Delivery Settings'}
            </button>
            {configSaved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
