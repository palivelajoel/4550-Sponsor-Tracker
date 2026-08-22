import { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion'
import { FONTS, C, sbFetch, isAuthed, canEditInventory, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, modalStyle, addBtnStyle, ghostBtn, dangerBtn, hubProxy, getTokenUserId } from "./hubUtils.jsx";
import Starfield from "./Starfield.jsx";

const CATEGORIES = [
  { value: "structural", label: "Structural", icon: "🔩" },
  { value: "drivetrain", label: "Drivetrain", icon: "⚙️" },
  { value: "electronics", label: "Electronics", icon: "🔌" },
  { value: "pneumatics", label: "Pneumatics", icon: "💨" },
  { value: "fastener", label: "Fastener", icon: "🔧" },
  { value: "tool", label: "Tool", icon: "🛠️" },
  { value: "consumable", label: "Consumable", icon: "📦" },
  { value: "cable", label: "Cable/Wire", icon: "🔌" },
  { value: "bearing", label: "Bearing", icon: "🔄" },
  { value: "motor", label: "Motor", icon: "⚡" },
  { value: "sensor", label: "Sensor", icon: "📡" },
  { value: "other", label: "Other", icon: "📁" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

export default function HubInventory() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditInventory());
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", quantity: 1, location: "", bin_location: "", category: "structural", tags: "", image_url: "", low_stock_threshold: 5, manufacturer: "", part_number: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const fileRef = useRef(null);
  const csvFileRef = useRef(null);
  const scannerRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Inventory · Team 4550";
    loadItems();
  }, []);

  async function loadItems() {
    const data = await sbFetch("inventory_items?select=*&order=created_at.desc");
    if (data) setItems(data);
    const tx = await sbFetch("inventory_transactions?select=*,item_id(id,name)&order=created_at.desc&limit=50");
    if (tx) setTransactions(tx);
  }

  function showToast(msg, color = "#22c55e") { setToast({ msg, color }); setTimeout(() => setToast(""), 3000); }

  function getDefaultForm() {
    return { name: "", description: "", quantity: 1, location: "", bin_location: "", category: "structural", tags: "", image_url: "", low_stock_threshold: 5, manufacturer: "", part_number: "" };
  }

  function openAdd() {
    setForm(getDefaultForm());
    setModal("add");
  }

  function openEdit(item) {
    setForm({
      name: item.name || "",
      description: item.description || "",
      quantity: item.quantity ?? 1,
      location: item.location || "",
      bin_location: item.bin_location || "",
      category: item.category || "structural",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || ""),
      image_url: item.image_url || "",
      low_stock_threshold: item.low_stock_threshold ?? 5,
      manufacturer: item.manufacturer || "",
      part_number: item.part_number || "",
    });
    setModal("edit");
  }

  function openQtyModal(item) {
    setForm({ ...item, qtyChange: 0, reason: "" });
    setModal("qty");
  }

  async function handleIdentify() {
    const file = fileRef.current?.files?.[0];
    if (!file) return showToast("Select an image first.", "#ef4444");
    setUploading(true);
    const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploadRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/inventory-images/${safeName}`, {
      method: "POST",
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!uploadRes.ok) { setUploading(false); showToast("Upload failed.", "#ef4444"); return; }
    const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/inventory-images/${safeName}`;
    setForm({ ...form, image_url: imageUrl });
    try {
      const res = await fetch("/api/identify-item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl }) });
      if (res.ok) {
        const ai = await res.json();
        const items = ai.items || [];
        if (items.length === 0) { showToast("AI didn't detect any items.", "#f59e0b"); setUploading(false); return; }
        let saved = 0;
        for (const item of items) {
          const tags = item.tags ? (Array.isArray(item.tags) ? item.tags : item.tags.split(",").map(t => t.trim()).filter(Boolean)) : [];
          try {
            await hubProxy("inventory_items", "insert", {
              name: item.name || "Unknown Item",
              description: item.description || "",
              quantity: item.estimated_quantity || 1,
              category: item.category || "other",
              tags,
              image_url: imageUrl,
              manufacturer: item.manufacturer || "",
              part_number: item.part_number || "",
              low_stock_threshold: 5,
              added_by: getTokenUserId(),
            });
            saved++;
          } catch {}
        }
        showToast(`✅ AI saved ${saved} item${saved > 1 ? "s" : ""}!`, "#22c55e");
        loadItems();
      } else {
        const errBody = await res.text().catch(() => "");
        let errMsg = "AI identification failed.";
        try { const j = JSON.parse(errBody); if (j?.error) errMsg = j.error; } catch {}
        showToast(errMsg, "#ef4444");
      }
    } catch { showToast("AI service unavailable.", "#ef4444"); }
    setUploading(false);
  }

  async function save() {
    if (!form.name.trim()) return showToast("Name is required.", "#ef4444");
    setSaving(true);
    try {
      const userId = getTokenUserId();
      const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        quantity: form.quantity,
        location: form.location.trim(),
        bin_location: form.bin_location.trim(),
        category: form.category,
        tags,
        image_url: form.image_url,
        low_stock_threshold: form.low_stock_threshold,
        manufacturer: form.manufacturer.trim(),
        part_number: form.part_number.trim(),
        added_by: userId,
      };
      if (modal === "add") {
        await hubProxy("inventory_items", "insert", payload);
        showToast("✅ Item added.");
      } else {
        const { id } = form;
        await hubProxy("inventory_items", "update", { id, updates: payload });
        showToast("✅ Item updated.");
      }
      setModal(null);
      loadItems();
    } catch (err) { showToast("Save failed: " + err.message, "#ef4444"); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this item?")) return;
    await hubProxy("inventory_items", "delete", { id });
    showToast("🗑️ Deleted.", "#ef4444");
    loadItems();
  }

  async function handleBulkDelete() {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} items?`)) return;
    for (const id of selectedItems) {
      await hubProxy("inventory_items", "delete", { id });
    }
    setSelectedItems(new Set());
    showToast(`🗑️ Deleted ${selectedItems.size} items.`, "#ef4444");
    loadItems();
  }

  async function toggleLowStock(item) {
    const newThreshold = (item.low_stock_threshold ?? 5) === -1 ? 5 : -1;
    await hubProxy("inventory_items", "update", { id: item.id, updates: { low_stock_threshold: newThreshold } });
    showToast(newThreshold === -1 ? "⚠️ Marked as low stock." : "✅ Low stock cleared.");
    loadItems();
  }

  async function handleQtyChange() {
    const item = form;
    const change = parseInt(form.qtyChange);
    if (!change || !form.reason.trim()) return showToast("Enter quantity change and reason.", "#ef4444");
    setSaving(true);
    try {
      const userId = getTokenUserId();
      const newQty = (item.quantity || 0) + change;
      await hubProxy("inventory_items", "update", { id: item.id, updates: { quantity: newQty } });
      await hubProxy("inventory_transactions", "insert", {
        item_id: item.id,
        change,
        new_quantity: newQty,
        reason: form.reason.trim(),
        user_id: userId,
      });
      setModal(null);
      showToast("✅ Quantity updated.");
      loadItems();
    } catch (err) { showToast("Update failed: " + err.message, "#ef4444"); }
    setSaving(false);
  }

  // ── Barcode scanning ──────────────────────────────────
  function startScanner() {
    setScannerOpen(true);
    setTimeout(() => {
      const video = document.getElementById("scanner-video");
      if (!video) return;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          video.srcObject = stream;
          video.play();
          scanIntervalRef.current = setInterval(captureScan, 1500);
        })
        .catch(() => showToast("Camera access denied.", "#ef4444"));
    }, 300);
  }

  function captureScan() {
    const video = document.getElementById("scanner-video");
    const canvas = document.getElementById("scanner-canvas");
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setForm(prev => ({ ...prev, image_url: dataUrl }));
  }

  function stopScanner() {
    clearInterval(scanIntervalRef.current);
    const video = document.getElementById("scanner-video");
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    setScannerOpen(false);
  }

  async function captureFrame() {
    captureScan();
    stopScanner();
    const canvas = document.getElementById("scanner-canvas");
    if (!canvas) return;
    setUploading(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); return showToast("Failed to capture.", "#ef4444"); }
      const safeName = `${Date.now()}-camera-capture.jpg`;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/inventory-images/${safeName}`, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: blob,
      });
      if (res.ok) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/inventory-images/${safeName}`;
        setForm(prev => ({ ...prev, image_url: url }));
        showToast("Camera image captured.");
      } else {
        showToast("Upload failed.", "#ef4444");
      }
      setUploading(false);
    }, "image/jpeg", 0.85);
  }

  // ── CSV Export/Import ──────────────────────────────────
  function exportCSV() {
    const headers = ["name","category","quantity","location","bin_location","tags","manufacturer","part_number","description","low_stock_threshold"];
    const rows = items.map(i => [
      `"${(i.name||"").replace(/"/g,'""')}"`,
      i.category || "",
      i.quantity ?? "",
      `"${(i.location||"").replace(/"/g,'""')}"`,
      `"${(i.bin_location||"").replace(/"/g,'""')}"`,
      `"${(Array.isArray(i.tags)?i.tags.join(", "):i.tags||"").replace(/"/g,'""')}"`,
      `"${(i.manufacturer||"").replace(/"/g,'""')}"`,
      `"${(i.part_number||"").replace(/"/g,'""')}"`,
      `"${(i.description||"").replace(/"/g,'""')}"`,
      i.low_stock_threshold ?? "",
    ]);
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory_export.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("✅ CSV exported.");
  }

  async function importCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) return showToast("CSV must have header + data rows.", "#ef4444");
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      try {
        const tags = row.tags ? row.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        await hubProxy("inventory_items", "insert", {
          name: row.name || "Imported Item",
          category: row.category || "other",
          quantity: parseInt(row.quantity) || 1,
          location: row.location || "",
          bin_location: row.bin_location || "",
          tags,
          manufacturer: row.manufacturer || "",
          part_number: row.part_number || "",
          description: row.description || "",
          low_stock_threshold: parseInt(row.low_stock_threshold) || 5,
        });
        imported++;
      } catch {}
    }
    showToast(`✅ Imported ${imported} items.`);
    loadItems();
  }

  // ── Filters ────────────────────────────────────────────
  const allTags = [...new Set(items.flatMap(i => Array.isArray(i.tags) ? i.tags : (i.tags ? i.tags.split(",").map(t => t.trim()) : [])))];

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) || i.bin_location?.toLowerCase().includes(q) || i.manufacturer?.toLowerCase().includes(q) || i.part_number?.toLowerCase().includes(q);
    const matchCategory = categoryFilter === "all" || i.category === categoryFilter;
    const matchTag = !tagFilter || (Array.isArray(i.tags) ? i.tags : (i.tags || "").split(",").map(t => t.trim())).includes(tagFilter);
    const matchLowStock = !lowStockOnly || (i.low_stock_threshold ?? 5) === -1;
    return matchSearch && matchCategory && matchTag && matchLowStock;
  });

  const lowStockCount = items.filter(i => (i.low_stock_threshold ?? 5) === -1).length;

  function toggleSelect(id) {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedItems(next);
  }

  function selectAll() {
    if (selectedItems.size === filtered.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filtered.map(i => i.id)));
  }

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2',sans-serif", position: "relative" }}>
      <Starfield density={11000} opacity={0.28} />
      <style>{FONTS}</style>
      <HubHeader title="📦 Inventory" subtitle="Parts, Tools & Supplies" />
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.color, color: "#fff", padding: "12px 20px", borderRadius: 8, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>{toast.msg}</div>}

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 18px", position: "relative", zIndex: 1 }}>
        {/* Low stock banner */}
        {lowStockCount > 0 && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: "#fca5a5", fontSize: 14 }}>⚠️ {lowStockCount} item{lowStockCount > 1 ? "s" : ""} manually marked low stock</span>
            <button onClick={() => { setLowStockOnly(true); setCategoryFilter("all"); setTagFilter(""); }} style={{ ...ghostBtn, fontSize: 11, color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>Show only low stock</button>
            {lowStockOnly && <button onClick={() => setLowStockOnly(false)} style={{ ...ghostBtn, fontSize: 11 }}>Show all</button>}
          </div>
        )}

        {/* Filters + Actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search name, location, part #..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 220, fontSize: 13 }} />
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setLowStockOnly(false); }} style={selectStyle}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            {allTags.length > 0 && (
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={selectStyle}>
                <option value="">All Tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>{filtered.length} items</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canEdit && <button onClick={openAdd} style={addBtnStyle}>+ Add Item</button>}
            {canEdit && selectedItems.size > 0 && <button onClick={handleBulkDelete} style={dangerBtn}>Delete {selectedItems.size}</button>}
            <button onClick={exportCSV} style={ghostBtn}>⬇ CSV</button>
            <button onClick={() => csvFileRef.current?.click()} style={ghostBtn}>⬆ CSV</button>
            <input ref={csvFileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={importCSV} />
          </div>
        </div>

        {/* Select all checkbox */}
        {filtered.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={selectedItems.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>Select all ({filtered.length})</span>
          </div>
        )}

        {/* Inventory grid */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {filtered.map((item, i) => {
            const isLow = (item.low_stock_threshold ?? 5) === -1;
            const itemTags = Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
            const catInfo = CATEGORY_MAP[item.category];
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.03 }} whileHover={{ scale: 1.01 }}
                style={{
                background: C.surface,
                border: `1px solid ${isLow ? "rgba(239,68,68,0.4)" : C.border}`,
                borderRadius: 10,
                padding: 16,
                position: "relative",
                opacity: selectedItems.has(item.id) ? 0.75 : 1,
                outline: selectedItems.has(item.id) ? "2px solid #ef4444" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {canEdit && (
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ marginTop: 4, cursor: "pointer" }} />
                  )}
                  {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{item.name}</div>
                      {catInfo && <span style={{ fontSize: 10, color: C.dim }}>{catInfo.icon}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, fontSize: 11, color: C.dim, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: isLow ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)", color: isLow ? "#fca5a5" : C.green, borderRadius: 10, padding: "1px 8px", fontFamily: "monospace", fontWeight: 700 }}>
                        Qty: {item.quantity ?? 0}
                      </span>
                      <span>{catInfo?.label || item.category}</span>
                      {item.part_number && <span style={{ color: C.muted }}>#{item.part_number}</span>}
                      {item.manufacturer && <span style={{ color: C.muted }}>{item.manufacturer}</span>}
                    </div>
                    {item.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{item.description}</div>}
                    {itemTags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {itemTags.map((tag, i) => (
                          <span key={i} style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: "monospace" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: C.dim, fontFamily: "monospace", flexWrap: "wrap" }}>
                      {item.location && <span>📍 {item.location}</span>}
                      {item.bin_location && <span>🗄️ {item.bin_location}</span>}
                      {isLow && <span style={{ color: "#fca5a5" }}>⚠️ Manually marked low stock</span>}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button onClick={() => toggleLowStock(item)} style={{ ...ghostBtn, color: isLow ? C.green : "#ef4444", border: `1px solid ${isLow ? C.green + "44" : "rgba(239,68,68,0.3)"}` }}>{isLow ? "✓ Clear Low Stock" : "⚠ Mark Low Stock"}</button>
                    <button onClick={() => openQtyModal(item)} style={{ ...ghostBtn, color: C.green, border: `1px solid ${C.green}44` }}>± Qty</button>
                    <button onClick={() => openEdit(item)} style={ghostBtn}>Edit</button>
                    <button onClick={() => handleDelete(item.id)} style={dangerBtn}>Delete</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", color: C.dim, marginTop: 40, fontFamily: "monospace", fontSize: 13 }}>No items found.</div>}

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 24, padding: 16 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, color: C.muted, marginBottom: 12, letterSpacing: 1 }}>📋 Recent Transactions</div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {transactions.slice(0, 20).map(tx => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 12, fontFamily: "monospace", color: C.muted }}>
                  <span style={{ color: C.text, minWidth: 60 }}>{(tx.item_id?.name || "?")}</span>
                  <span style={{ color: tx.change > 0 ? C.green : C.red }}>{tx.change > 0 ? "+" : ""}{tx.change}</span>
                  <span style={{ color: C.dim, flex: 1, textAlign: "right" }}>{tx.reason}</span>
                  <span style={{ color: C.dim, fontSize: 10 }}>{tx.created_at?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {modal === "add" || modal === "edit" ? (
        <div style={overlayStyle} onClick={() => { stopScanner(); setModal(null); }}>
          <div style={{ ...modalStyle, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, letterSpacing: 2 }}>{modal === "add" ? "Add Item" : "Edit Item"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input placeholder="Item name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <input type="number" placeholder="Qty" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} style={{ ...inputStyle, width: 70 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...selectStyle, flex: 1 }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input placeholder="Location (e.g., Shelf A2)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="Bin (e.g., B3)" value={form.bin_location} onChange={e => setForm({ ...form, bin_location: e.target.value })} style={{ ...inputStyle, width: 100 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input placeholder="Manufacturer" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="Part #" value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <input placeholder="Tags (comma-separated, e.g., 2024, aluminum, 1x1)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={inputStyle} />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />

              {/* Image + AI Identify */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => fileRef.current?.click()} style={ghostBtn}>{uploading ? "Uploading..." : "📷 Upload & AI Identify"}</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIdentify} />
                {form.image_url && <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>✅ Image set</span>}
                <button onClick={startScanner} style={ghostBtn}>📸 Camera</button>
              </div>

              {/* Scanner */}
              {scannerOpen && (
                <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <video id="scanner-video" style={{ width: "100%", maxHeight: 240, display: "block", background: "#000" }} />
                  <canvas id="scanner-canvas" style={{ display: "none" }} />
                  <div style={{ display: "flex", gap: 8, padding: 8, background: "rgba(0,0,0,0.8)" }}>
                    <button onClick={captureFrame} style={{ ...addBtnStyle, flex: 1, fontSize: 12 }}>📸 Capture</button>
                    <button onClick={stopScanner} style={{ ...dangerBtn, flex: 1, fontSize: 12 }}>Cancel</button>
                  </div>
                </div>
              )}

              {form.image_url && !scannerOpen && <img src={form.image_url} alt="Preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }} />}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={save} disabled={saving} style={{ ...addBtnStyle, flex: 1 }}>{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => { stopScanner(); setModal(null); }} style={dangerBtn}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quantity Change Modal */}
      {modal === "qty" ? (
        <div style={overlayStyle} onClick={() => setModal(null)}>
          <div style={{ ...modalStyle, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, letterSpacing: 2 }}>Update Quantity — {form.name}</div>
            <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace", marginBottom: 12 }}>Current: {form.quantity ?? 0}</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input type="number" placeholder="Change (+ or -)" value={form.qtyChange} onChange={e => setForm({ ...form, qtyChange: e.target.value })} style={inputStyle} />
            </div>
            <input placeholder="Reason (e.g., Used in build, New shipment)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={inputStyle} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={handleQtyChange} disabled={saving} style={{ ...addBtnStyle, flex: 1, background: C.green }}>{saving ? "Saving..." : "Update"}</button>
              <button onClick={() => setModal(null)} style={dangerBtn}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}