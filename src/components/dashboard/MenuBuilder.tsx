'use client';

import { useState } from 'react';

function formatPrice(cents: number): string {
  return cents === 0 ? 'Free' : `${cents > 0 ? '+' : ''}$${(cents / 100).toFixed(2)}`;
}

interface Category { clover_category_id: string; name: string; sort_order: number }
interface ModifierGroup { clover_mg_id: string; name: string; min_required: number; max_allowed: number }
interface Modifier { clover_modifier_id: string; clover_mg_id: string; name: string; price_cents: number; available: boolean }

interface Props {
  mid: string;
  tier: string;
  categories: Category[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
}

export function MenuBuilder({ mid, tier, categories: initCats, modifierGroups: initGroups, modifiers: initMods }: Props) {
  const isPremium = tier === 'premium';
  const [cats, setCats] = useState(initCats);
  const [groups, setGroups] = useState(initGroups);
  const [mods, setMods] = useState(initMods);
  const [saving, setSaving] = useState(false);

  // Category form
  const [newCatName, setNewCatName] = useState('');
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Modifier Group form
  const [newMgName, setNewMgName] = useState('');
  const [newMgMin, setNewMgMin] = useState(0);
  const [newMgMax, setNewMgMax] = useState(1);
  // Modifier form
  const [addingModTo, setAddingModTo] = useState<string | null>(null);
  const [newModName, setNewModName] = useState('');
  const [newModPrice, setNewModPrice] = useState('0');

  const api = async (url: string, body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mid, ...body }) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || 'Failed'); return null; }
    return data;
  };

  // ===== CATEGORY ACTIONS =====
  const createCategory = async () => {
    if (!newCatName) return;
    const data = await api('/api/merchants/categories', { action: 'create', name: newCatName });
    if (data) { setCats([...cats, { clover_category_id: data.clover_category_id, name: newCatName, sort_order: 0 }]); setNewCatName(''); }
  };
  const updateCategory = async () => {
    if (!editCat || !editCatName) return;
    await api('/api/merchants/categories', { action: 'update', clover_category_id: editCat.clover_category_id, name: editCatName });
    setCats(cats.map(c => c.clover_category_id === editCat.clover_category_id ? { ...c, name: editCatName } : c));
    setEditCat(null);
  };
  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    await api('/api/merchants/categories', { action: 'delete', clover_category_id: cat.clover_category_id });
    setCats(cats.filter(c => c.clover_category_id !== cat.clover_category_id));
  };

  // ===== MODIFIER GROUP ACTIONS =====
  const createGroup = async () => {
    if (!newMgName) return;
    const data = await api('/api/merchants/modifier-groups', { action: 'create', resource: 'group', name: newMgName, min_required: newMgMin, max_allowed: newMgMax });
    if (data) { setGroups([...groups, { clover_mg_id: data.clover_mg_id, name: newMgName, min_required: newMgMin, max_allowed: newMgMax }]); setNewMgName(''); }
  };
  const deleteGroup = async (mg: ModifierGroup) => {
    if (!confirm(`Delete modifier group "${mg.name}" and all its modifiers?`)) return;
    await api('/api/merchants/modifier-groups', { action: 'delete', resource: 'group', clover_mg_id: mg.clover_mg_id });
    setGroups(groups.filter(g => g.clover_mg_id !== mg.clover_mg_id));
    setMods(mods.filter(m => m.clover_mg_id !== mg.clover_mg_id));
  };

  // ===== MODIFIER ACTIONS =====
  const createModifier = async (mgId: string) => {
    if (!newModName) return;
    const priceCents = Math.round(parseFloat(newModPrice || '0') * 100);
    const data = await api('/api/merchants/modifier-groups', { action: 'create', resource: 'modifier', clover_mg_id: mgId, name: newModName, price_cents: priceCents });
    if (data) { setMods([...mods, { clover_modifier_id: data.clover_modifier_id, clover_mg_id: mgId, name: newModName, price_cents: priceCents, available: true }]); setNewModName(''); setNewModPrice('0'); setAddingModTo(null); }
  };
  const deleteModifier = async (mod: Modifier) => {
    if (!confirm(`Delete modifier "${mod.name}"?`)) return;
    await api('/api/merchants/modifier-groups', { action: 'delete', resource: 'modifier', clover_mg_id: mod.clover_mg_id, clover_modifier_id: mod.clover_modifier_id });
    setMods(mods.filter(m => m.clover_modifier_id !== mod.clover_modifier_id));
  };

  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
          Upgrade to <strong>Premium</strong> to manage categories, modifier groups, and modifiers. All changes sync to Clover POS in real-time.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-glass-surface rounded-2xl border border-glass-border p-5">
            <h3 className="font-semibold text-sm text-glass-primary mb-2">Categories ({cats.length})</h3>
            <div className="space-y-1">{cats.map(c => <div key={c.clover_category_id} className="text-sm text-glass-secondary py-1">{c.name}</div>)}</div>
          </div>
          <div className="bg-glass-surface rounded-2xl border border-glass-border p-5">
            <h3 className="font-semibold text-sm text-glass-primary mb-2">Modifier Groups ({groups.length})</h3>
            <div className="space-y-1">{groups.map(g => <div key={g.clover_mg_id} className="text-sm text-glass-secondary py-1">{g.name} <span className="text-xs text-gray-400">({mods.filter(m => m.clover_mg_id === g.clover_mg_id).length} options)</span></div>)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-400">All changes sync to Clover POS in real-time. {saving && <span className="text-blue-600 font-medium">Syncing...</span>}</p>

      {/* ===== CATEGORIES ===== */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-glass-primary">Categories ({cats.length})</h3>
        </div>

        <div className="space-y-2 mb-4">
          {cats.map(c => (
            <div key={c.clover_category_id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-glass-neutral">
              {editCat?.clover_category_id === c.clover_category_id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)}
                    className="flex-1 border border-glass-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt" />
                  <button onClick={updateCategory} className="text-xs text-blue-600 font-medium">Save</button>
                  <button onClick={() => setEditCat(null)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-700 font-medium">{c.name}</span>
                  <div className="flex gap-3">
                    <button onClick={() => { setEditCat(c); setEditCatName(c.name); }} className="text-xs text-cobalt hover:text-cobalt-600">Edit</button>
                    <button onClick={() => deleteCategory(c)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category name"
            className="flex-1 border border-glass-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt" />
          <button onClick={createCategory} disabled={!newCatName || saving}
            className="bg-cobalt text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cobalt-600 disabled:bg-gray-200 disabled:text-gray-400">
            Add
          </button>
        </div>
      </div>

      {/* ===== MODIFIER GROUPS ===== */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border p-5">
        <h3 className="font-bold text-sm text-glass-primary mb-4">Modifier Groups ({groups.length})</h3>

        <div className="space-y-4 mb-4">
          {groups.map(mg => {
            const groupMods = mods.filter(m => m.clover_mg_id === mg.clover_mg_id);
            return (
              <div key={mg.clover_mg_id} className="border border-glass-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm text-glass-primary">{mg.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {mg.min_required > 0 ? 'Required' : 'Optional'} &middot; Max {mg.max_allowed}
                    </span>
                  </div>
                  <button onClick={() => deleteGroup(mg)} className="text-xs text-red-400 hover:text-red-600">Delete Group</button>
                </div>

                {/* Modifiers list */}
                <div className="space-y-1 ml-3 mb-2">
                  {groupMods.map(mod => (
                    <div key={mod.clover_modifier_id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-glass-secondary">{mod.name} <span className="text-gray-400">{formatPrice(mod.price_cents)}</span></span>
                      <button onClick={() => deleteModifier(mod)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Add modifier */}
                {addingModTo === mg.clover_mg_id ? (
                  <div className="flex gap-2 ml-3">
                    <input type="text" value={newModName} onChange={e => setNewModName(e.target.value)} placeholder="Modifier name"
                      className="flex-1 border border-glass-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt" />
                    <input type="number" step="0.01" value={newModPrice} onChange={e => setNewModPrice(e.target.value)} placeholder="0.00"
                      className="w-20 border border-glass-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt" />
                    <button onClick={() => createModifier(mg.clover_mg_id)} disabled={!newModName || saving}
                      className="text-xs text-blue-600 font-medium">Add</button>
                    <button onClick={() => setAddingModTo(null)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingModTo(mg.clover_mg_id); setNewModName(''); setNewModPrice('0'); }}
                    className="text-xs text-cobalt hover:text-cobalt-600 font-medium ml-3">
                    + Add modifier
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Create modifier group */}
        <div className="border-t border-glass-border pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-glass-secondary uppercase tracking-wider">New Modifier Group</h4>
          <div className="flex gap-2">
            <input type="text" value={newMgName} onChange={e => setNewMgName(e.target.value)} placeholder="Group name (e.g. Size, Toppings)"
              className="flex-1 border border-glass-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt" />
            <select value={newMgMin} onChange={e => setNewMgMin(Number(e.target.value))}
              className="border border-glass-border rounded-lg px-2 py-2 text-sm">
              <option value={0}>Optional</option>
              <option value={1}>Required (min 1)</option>
            </select>
            <select value={newMgMax} onChange={e => setNewMgMax(Number(e.target.value))}
              className="border border-glass-border rounded-lg px-2 py-2 text-sm">
              <option value={1}>Pick 1</option>
              <option value={2}>Up to 2</option>
              <option value={3}>Up to 3</option>
              <option value={5}>Up to 5</option>
              <option value={10}>Up to 10</option>
            </select>
            <button onClick={createGroup} disabled={!newMgName || saving}
              className="bg-cobalt text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cobalt-600 disabled:bg-gray-200 disabled:text-gray-400">
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
