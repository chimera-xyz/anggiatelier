"use client";

import Image from "next/image";
import { useState } from "react";
import { Archive, ImagePlus, LoaderCircle, PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { archiveProduct, saveProduct, uploadProductImage } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { Product, ProductDraft } from "@/lib/types";

type ToastSetter = (toast: { message: string; type: "success" | "error" }) => void;
const blankVariant = (code = ""): ProductDraft["variants"][number] => ({ sku: `${code}-`, color: "Burgundy", colorHex: "#7d1837", size: "M", stock: 1, active: true });
const blankDraft = (): ProductDraft => ({ code: "", name: "", description: "", price: 199000, images: ["/products/cardigan-101.png"], active: true, weightGrams: 700, lengthCm: 30, widthCm: 24, heightCm: 8, variants: [blankVariant()] });

export function ProductManager({ products, refresh, toast }: { products: Product[]; refresh: () => Promise<void>; toast: ToastSetter }) {
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [draft, setDraft] = useState<ProductDraft>(blankDraft());
  const [busy, setBusy] = useState(false);

  function open(product?: Product) {
    setEditing(product || "new");
    setDraft(product ? {
      code: product.code, name: product.name, description: product.description, price: product.price, images: product.images,
      active: product.active, weightGrams: product.weightGrams, lengthCm: product.lengthCm, widthCm: product.widthCm, heightCm: product.heightCm,
      variants: product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, color: variant.color, colorHex: variant.colorHex, size: variant.size, stock: variant.stock, active: variant.active })),
    } : blankDraft());
  }

  async function submit() {
    setBusy(true);
    try {
      await saveProduct(draft, editing !== "new" ? editing?.id : undefined);
      await refresh();
      setEditing(null);
      toast({ message: editing === "new" ? "Produk dan varian berhasil ditambahkan." : "Perubahan produk berhasil disimpan.", type: "success" });
    } catch (error) { toast({ message: error instanceof Error ? error.message : "Produk gagal disimpan.", type: "error" }); }
    finally { setBusy(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadProductImage(file);
      setDraft((value) => ({ ...value, images: [url, ...value.images.filter((image) => image !== url)] }));
      toast({ message: "Foto produk berhasil diunggah.", type: "success" });
    } catch (error) { toast({ message: error instanceof Error ? error.message : "Foto gagal diunggah.", type: "error" }); }
    finally { setBusy(false); }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Arsipkan produk ${product.code}? Produk tidak lagi tampil di toko.`)) return;
    try { await archiveProduct(product.id); await refresh(); toast({ message: `Produk ${product.code} diarsipkan.`, type: "success" }); }
    catch (error) { toast({ message: error instanceof Error ? error.message : "Produk gagal diarsipkan.", type: "error" }); }
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">Katalog & stok</p><h1 className="mt-2 font-display text-4xl font-semibold">Produk dan varian</h1><p className="mt-2 text-sm text-[#756a6e]">Stok disimpan per kombinasi warna dan ukuran, bukan sekadar total produk.</p></div>
        <button onClick={() => open()} className="primary-button"><PackagePlus className="size-4" /> Tambah produk</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {products.map((product) => <article key={product.id} className={`surface flex gap-4 p-4 ${product.active ? "" : "opacity-60"}`}>
          <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-[#f1e7e0]"><Image src={product.image} alt={product.name} fill className="object-cover" sizes="112px" /></div>
          <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><span className="text-[11px] font-extrabold tracking-[.12em] text-[#a33c5b]">KODE {product.code}</span><h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{product.name}</h2></div><span className={product.active ? "status-pill status-paid" : "status-pill status-cancelled"}>{product.active ? "Aktif" : "Arsip"}</span></div>
            <p className="mt-2 text-sm font-bold text-[#8a2949]">{formatRupiah(product.price)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]"><Stat label="Varian" value={product.variants.length} /><Stat label="Stok" value={product.stock} /><Stat label="Dikunci" value={product.reserved} /></div>
            <div className="mt-3 flex gap-2"><button onClick={() => open(product)} className="ghost-button min-h-9 px-3 text-xs"><Pencil className="size-3.5" /> Edit</button>{product.active ? <button onClick={() => archive(product)} className="danger-button min-h-9 px-3 text-xs"><Archive className="size-3.5" /> Arsipkan</button> : null}</div>
          </div>
        </article>)}
      </div>

      {editing ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#210710]/75 p-3 backdrop-blur-sm"><div className="my-4 w-full max-w-5xl overflow-hidden rounded-[28px] bg-[#fffaf7] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eadedd] bg-white px-5 py-4 sm:px-7"><div><p className="text-xs font-bold text-[#a33c5b]">PRODUCT EDITOR</p><h2 className="font-display text-3xl font-semibold">{editing === "new" ? "Tambah produk" : `Edit kode ${editing.code}`}</h2></div><button onClick={() => setEditing(null)} className="grid size-10 place-items-center rounded-xl border border-[#eadedd]"><X className="size-4" /></button></div>
        <div className="max-h-[80vh] overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
            <div className="space-y-4"><div className="relative aspect-[4/4.4] overflow-hidden rounded-2xl border border-[#eadedd] bg-[#f1e7e0]"><Image src={draft.images[0] || "/products/cardigan-101.png"} alt="Preview" fill className="object-cover" sizes="400px" /></div><label className="secondary-button w-full"><ImagePlus className="size-4" /> Unggah foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => upload(event.target.files?.[0])} /></label><Field label="URL foto utama"><input className="input-shell" value={draft.images[0] || ""} onChange={(event) => setDraft({ ...draft, images: [event.target.value, ...draft.images.slice(1)] })} /></Field></div>
            <div className="grid content-start gap-4 sm:grid-cols-2"><Field label="Kode produk"><input className="input-shell" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></Field><Field label="Harga"><input className="input-shell" type="number" min="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></Field><div className="sm:col-span-2"><Field label="Nama produk"><input className="input-shell" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Deskripsi"><textarea className="input-shell" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field></div>
              <Field label="Berat (gram)"><input className="input-shell" type="number" min="1" value={draft.weightGrams} onChange={(event) => setDraft({ ...draft, weightGrams: Number(event.target.value) })} /></Field><label className="flex items-center gap-3 rounded-2xl border border-[#eadedd] bg-white px-4 text-sm font-bold"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="size-4 accent-[#8a2949]" /> Produk aktif</label>
              <Field label="Panjang (cm)"><input className="input-shell" type="number" min="1" value={draft.lengthCm} onChange={(event) => setDraft({ ...draft, lengthCm: Number(event.target.value) })} /></Field><Field label="Lebar (cm)"><input className="input-shell" type="number" min="1" value={draft.widthCm} onChange={(event) => setDraft({ ...draft, widthCm: Number(event.target.value) })} /></Field><Field label="Tinggi (cm)"><input className="input-shell" type="number" min="1" value={draft.heightCm} onChange={(event) => setDraft({ ...draft, heightCm: Number(event.target.value) })} /></Field>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between"><div><h3 className="font-display text-3xl font-semibold">Varian SKU</h3><p className="text-xs text-[#756a6e]">Setiap baris adalah stok nyata yang dapat direservasi.</p></div><button onClick={() => setDraft({ ...draft, variants: [...draft.variants, blankVariant(draft.code)] })} className="ghost-button"><Plus className="size-4" /> Varian</button></div>
          <div className="mt-4 space-y-3">{draft.variants.map((variant, index) => <div key={variant.id || index} className="grid gap-3 rounded-2xl border border-[#eadedd] bg-white p-3 sm:grid-cols-[1.2fr_1fr_80px_100px_54px_42px]">
            <input aria-label="SKU" className="input-shell min-h-10" placeholder="SKU" value={variant.sku} onChange={(e) => updateVariant(setDraft, draft, index, "sku", e.target.value)} /><input aria-label="Warna" className="input-shell min-h-10" placeholder="Warna" value={variant.color} onChange={(e) => updateVariant(setDraft, draft, index, "color", e.target.value)} /><input aria-label="Warna hex" className="h-10 w-full rounded-xl border border-[#eadedd] p-1" type="color" value={variant.colorHex} onChange={(e) => updateVariant(setDraft, draft, index, "colorHex", e.target.value)} /><input aria-label="Ukuran" className="input-shell min-h-10" placeholder="Size" value={variant.size} onChange={(e) => updateVariant(setDraft, draft, index, "size", e.target.value.toUpperCase())} /><input aria-label="Stok" className="input-shell min-h-10 px-2" type="number" min="0" value={variant.stock} onChange={(e) => updateVariant(setDraft, draft, index, "stock", Number(e.target.value))} /><button aria-label="Hapus varian" onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, item) => item !== index) })} className="grid size-10 place-items-center rounded-xl text-[#a52f3a] hover:bg-[#fff0f1]"><Trash2 className="size-4" /></button>
          </div>)}</div>
          <div className="mt-7 flex justify-end gap-3"><button onClick={() => setEditing(null)} className="ghost-button">Batal</button><button onClick={submit} disabled={busy || !draft.code || !draft.name || !draft.variants.length} className="primary-button">{busy ? <LoaderCircle className="size-4 animate-spin" /> : null} Simpan produk</button></div>
        </div>
      </div></div> : null}
    </section>
  );
}

function updateVariant(setDraft: React.Dispatch<React.SetStateAction<ProductDraft>>, draft: ProductDraft, index: number, key: keyof ProductDraft["variants"][number], value: string | number | boolean) {
  const variants = draft.variants.map((variant, item) => item === index ? { ...variant, [key]: value } : variant);
  setDraft({ ...draft, variants });
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#fff7f5] px-2 py-2"><strong className="block text-sm">{value}</strong><span className="text-[#817379]">{label}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-xs font-bold text-[#5f5055]"><span>{label}</span>{children}</label>; }
