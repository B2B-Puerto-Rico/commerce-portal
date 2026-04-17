'use client';

import { useState } from 'react';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Product {
  clover_item_id: string;
  name: string;
  price_cents: number;
  description: string | null;
  image_url: string | null;
  sku: string | null;
  in_stock: boolean;
  hidden_online: boolean;
  hidden_in_clover: boolean;
  last_synced_at: string | null;
}

interface Category {
  clover_category_id: string;
  name: string;
}

interface Props {
  mid: string;
  tier: string;
  products: Product[];
  categories: Category[];
}

export function ProductsTab({ mid, tier, products: initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStock, setEditStock] = useState(true);
  const [editHidden, setEditHidden] = useState(false);
  const [editShowOnPOS, setEditShowOnPOS] = useState(true);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const canEdit = tier === 'pro' || tier === 'premium';
  const canCreate = tier === 'premium';

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditName(p.name);
    setEditPrice((p.price_cents / 100).toFixed(2));
    setEditDesc(p.description || '');
    setEditStock(p.in_stock);
    setEditHidden(p.hidden_online);
    setEditShowOnPOS(!p.hidden_in_clover);
    setEditImageUrl(p.image_url);
  };

  const handleImageUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mid', mid);
    formData.append('clover_item_id', editing.clover_item_id);

    const res = await fetch('/api/merchants/products/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setEditImageUrl(data.image_url);
      setProducts(products.map((p) =>
        p.clover_item_id === editing.clover_item_id
          ? { ...p, image_url: data.image_url }
          : p
      ));
    } else {
      const data = await res.json();
      alert(data.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const priceCents = Math.round(parseFloat(editPrice) * 100);

    const res = await fetch('/api/merchants/products/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        clover_item_id: editing.clover_item_id,
        name: editName,
        price_cents: priceCents,
        description: editDesc,
        in_stock: editStock,
        hidden_online: editHidden,
        hidden_in_clover: !editShowOnPOS,
      }),
    });

    if (res.ok) {
      setProducts(products.map((p) =>
        p.clover_item_id === editing.clover_item_id
          ? { ...p, name: editName, price_cents: priceCents, description: editDesc, in_stock: editStock, hidden_online: editHidden, hidden_in_clover: !editShowOnPOS }
          : p
      ));
      setEditing(null);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (cloverItemId: string, itemName: string) => {
    if (!confirm(`Delete "${itemName}"? This removes it from Clover POS and your online menu.`)) return;
    const res = await fetch('/api/merchants/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mid, clover_item_id: cloverItemId }),
    });
    if (res.ok) {
      setProducts(products.filter((p) => p.clover_item_id !== cloverItemId));
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete');
    }
  };

  const handleCreate = async () => {
    if (!newName || !newPrice) return;
    setSaving(true);
    const priceCents = Math.round(parseFloat(newPrice) * 100);

    const res = await fetch('/api/merchants/products/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid,
        name: newName,
        price_cents: priceCents,
        description: newDesc || null,
        category_id: newCategory || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setProducts([...products, {
        clover_item_id: data.clover_item_id,
        name: newName,
        price_cents: priceCents,
        description: newDesc || null,
        image_url: null,
        sku: null,
        in_stock: true,
        hidden_online: false,
        hidden_in_clover: false,
        last_synced_at: new Date().toISOString(),
      }]);
      setCreating(false);
      setNewName('');
      setNewPrice('');
      setNewDesc('');
      setNewCategory('');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create');
    }
    setSaving(false);
  };

  return (
    <div>
      {/* Header with Add button */}
      {canCreate && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="mb-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700">
          Upgrade to <strong>Pro</strong> to edit products or <strong>Premium</strong> to create new ones. Changes sync to your Clover POS in real-time.
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Product</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Price</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Stock</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Cart</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">POS</th>
              {canEdit && <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((p) => (
              <tr key={p.clover_item_id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-gray-900">{p.name}</span>
                      {p.description ? <span className="block text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</span> : null}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-700">{formatPrice(p.price_cents)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${p.in_stock ? 'text-green-600' : 'text-red-500'}`}>
                    {p.in_stock ? 'In stock' : 'Out of stock'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${!p.hidden_online ? 'text-green-600' : 'text-gray-400'}`}>
                    {!p.hidden_online ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${!p.hidden_in_clover ? 'text-green-600' : 'text-gray-400'}`}>
                    {!p.hidden_in_clover ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Edit
                    </button>
                    {canCreate && (
                      <button onClick={() => handleDelete(p.clover_item_id, p.name)} className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">Edit Product</h3>
                <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <p className="text-xs text-gray-400">Changes sync to Clover POS in real-time.</p>

              {/* Image upload */}
              <div
                className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('product-image-input')?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/50'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50');
                  const file = e.dataTransfer.files[0];
                  if (file) handleImageUpload(file);
                }}
              >
                {editImageUrl ? (
                  <div className="relative">
                    <img src={editImageUrl} alt="" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white font-medium text-sm opacity-0 hover:opacity-100 transition-opacity">
                        Click or drag to replace
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-t-transparent" />
                        <span className="text-xs text-gray-500">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-gray-400">Click or drag an image here</p>
                        <p className="text-[10px] text-gray-300 mt-1">JPEG, PNG, WebP up to 5MB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editing) return;
                            const model = prompt('Choose AI model:\n1. flux (best quality)\n2. sdxl (fast)\n3. playground (creative)\n\nType model name:', 'flux');
                            if (!model) return;
                            setUploading(true);
                            fetch('/api/merchants/generate-image', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mid, clover_item_id: editing.clover_item_id, product_name: editing.name, model }),
                            }).then(r => r.json()).then(data => {
                              if (data.image_url) {
                                setEditImageUrl(data.image_url);
                                setProducts(products.map(p => p.clover_item_id === editing.clover_item_id ? { ...p, image_url: data.image_url } : p));
                              } else {
                                alert(data.error || 'Generation failed');
                              }
                              setUploading(false);
                            }).catch(() => setUploading(false));
                          }}
                          className="mt-2 text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Generate with AI
                        </button>
                      </>
                    )}
                  </div>
                )}
                <input
                  id="product-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">In stock</span>
                  <button onClick={() => setEditStock(!editStock)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editStock ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editStock ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Hidden from cart</span>
                  <button onClick={() => setEditHidden(!editHidden)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editHidden ? 'bg-red-400' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editHidden ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-700">Show on POS</span>
                    <span className="block text-xs text-gray-400">Visible on Clover devices</span>
                  </div>
                  <button onClick={() => setEditShowOnPOS(!editShowOnPOS)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editShowOnPOS ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editShowOnPOS ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 active:scale-[0.98] transition-all">
                  {saving ? 'Saving...' : 'Save & Sync to Clover'}
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create modal */}
      {creating && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setCreating(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">New Product</h3>
                <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <p className="text-xs text-gray-400">Creates the item in Clover POS and your online menu simultaneously.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price ($) *</label>
                  <input type="number" step="0.01" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Optional description"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                {categories.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.clover_category_id} value={c.clover_category_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={saving || !newName || !newPrice}
                  className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 active:scale-[0.98] transition-all">
                  {saving ? 'Creating...' : 'Create & Push to Clover'}
                </button>
                <button onClick={() => setCreating(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
