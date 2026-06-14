"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { PaymentLogo } from "@/components/payment-logo";
import { deletePaymentMethod, savePaymentMethod } from "@/lib/api-client";
import { defaultQrisStaticPayload, getQrisMerchantName } from "@/lib/qris";
import type { PaymentMethodConfig, PaymentMethodDraft } from "@/lib/types";

type ToastSetter = (toast: { message: string; type: "success" | "error" }) => void;

function blank(sortOrder: number): PaymentMethodDraft {
  return {
    type: "bank_transfer",
    name: "",
    bankCode: "",
    accountNumber: "",
    accountHolder: "ANGGI ATELIER",
    qrisPayload: "",
    instructions: "Transfer sesuai total order, lalu kirim bukti pembayaran.",
    enabled: true,
    sortOrder,
  };
}

export function PaymentManager({ methods, refresh, toast }: { methods: PaymentMethodConfig[]; refresh: () => Promise<void>; toast: ToastSetter }) {
  const sorted = useMemo(() => [...methods].sort((a, b) => a.sortOrder - b.sortOrder), [methods]);
  const [draft, setDraft] = useState<PaymentMethodDraft>(() => sorted[0] || blank(10));
  const [busy, setBusy] = useState(false);
  const isQris = draft.type === "qris";

  async function save() {
    setBusy(true);
    try {
      await savePaymentMethod(draft);
      await refresh();
      toast({ message: "Metode pembayaran disimpan.", type: "success" });
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "Metode pembayaran gagal disimpan.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Hapus ${draft.name}?`)) return;
    setBusy(true);
    try {
      await deletePaymentMethod(draft.id);
      await refresh();
      setDraft(blank((sorted.length + 1) * 10));
      toast({ message: "Metode pembayaran dihapus.", type: "success" });
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "Metode pembayaran gagal dihapus.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">Payment setup</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Metode pembayaran</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#756a6e]">Atur rekening transfer dan payload QRIS dinamis yang muncul di checkout buyer.</p>
        </div>
        <button onClick={() => setDraft(blank((sorted.length + 1) * 10))} className="primary-button">
          <Plus className="size-4" /> Metode baru
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="surface overflow-hidden">
          <div className="border-b border-[#eadedd] p-5">
            <h2 className="font-display text-2xl font-semibold">Daftar aktif</h2>
          </div>
          <div className="divide-y divide-[#eadedd]">
            {sorted.map((method) => (
              <button
                key={method.id}
                onClick={() => setDraft(method)}
                className={`flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#fff9f7] ${draft.id === method.id ? "bg-[#fff1f4]" : ""}`}
              >
                <PaymentLogo payment={method} compact />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{method.name}</strong>
                  <span className="mt-1 block truncate text-xs text-[#756a6e]">
                    {method.type === "qris" ? "QRIS dinamis" : method.accountNumber || "Nomor rekening belum diisi"}
                  </span>
                </div>
                <span className={`status-pill ${method.enabled ? "status-paid" : "status-cancelled"}`}>{method.enabled ? "Aktif" : "Nonaktif"}</span>
              </button>
            ))}
            {!sorted.length ? <p className="p-8 text-center text-sm text-[#756a6e]">Belum ada metode pembayaran.</p> : null}
          </div>
        </div>

        <div className="surface p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PaymentLogo payment={draft} compact />
              <h2 className="font-display text-3xl font-semibold">{draft.id ? "Edit payment" : "Payment baru"}</h2>
            </div>
            {draft.id ? <button disabled={busy} onClick={remove} className="danger-button px-3"><Trash2 className="size-4" /> Hapus</button> : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Jenis">
              <select className="input-shell" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as PaymentMethodConfig["type"] })}>
                <option value="bank_transfer">Transfer bank</option>
                <option value="qris">QRIS</option>
              </select>
            </Field>
            <Field label="Nama tampil">
              <input className="input-shell" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={isQris ? "QRIS Dinamis" : "BCA"} />
            </Field>

            {!isQris ? (
              <>
                <Field label="Kode bank">
                  <input className="input-shell" value={draft.bankCode || ""} onChange={(event) => setDraft({ ...draft, bankCode: event.target.value })} placeholder="bca" />
                </Field>
                <Field label="Nomor rekening">
                  <input className="input-shell" value={draft.accountNumber || ""} onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value })} placeholder="1234567890" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Atas nama">
                    <input className="input-shell" value={draft.accountHolder || ""} onChange={(event) => setDraft({ ...draft, accountHolder: event.target.value })} placeholder="ANGGI ATELIER" />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="sm:col-span-2">
                  <Field label="Static payload QRIS">
                    <textarea className="input-shell min-h-36 font-mono text-xs" value={draft.qrisPayload || ""} onChange={(event) => { const qrisPayload = event.target.value; setDraft({ ...draft, qrisPayload, accountHolder: getQrisMerchantName(qrisPayload) || draft.accountHolder }); }} />
                  </Field>
                  <button type="button" onClick={() => setDraft({ ...draft, qrisPayload: defaultQrisStaticPayload, accountHolder: getQrisMerchantName(defaultQrisStaticPayload) })} className="ghost-button mt-2 px-3 text-xs">
                    Pakai core QRIS dari file lama
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Atas nama merchant QRIS">
                    <input className="input-shell" value={draft.accountHolder || ""} onChange={(event) => setDraft({ ...draft, accountHolder: event.target.value })} placeholder="Nama yang tampil saat QR dipindai" />
                  </Field>
                </div>
              </>
            )}

            <Field label="Urutan">
              <input className="input-shell" type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} />
            </Field>
            <label className="flex items-center gap-3 rounded-2xl border border-[#eadedd] bg-[#fff9f7] px-4 py-3 text-sm font-bold">
              <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} className="size-4 accent-[#9c2347]" />
              Tampilkan di checkout
            </label>
            <div className="sm:col-span-2">
              <Field label="Instruksi pendek">
                <textarea className="input-shell" value={draft.instructions || ""} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Transfer sesuai total order, lalu kirim bukti pembayaran." />
              </Field>
            </div>
          </div>

          <button disabled={busy || !draft.name} onClick={save} className="primary-button mt-6 w-full">
            <Save className="size-4" /> Simpan payment
          </button>

          {isQris ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#dfe8e3] bg-[#f7fbf9] p-4 text-xs leading-5 text-[#397154]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              QRIS akan dibuat dinamis mengikuti total order, termasuk ongkir.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-xs font-bold text-[#5f5055]"><span>{label}</span>{children}</label>;
}
