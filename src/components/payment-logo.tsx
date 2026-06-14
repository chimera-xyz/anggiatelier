import { QrCode } from "lucide-react";
import type { PaymentDetails, PaymentMethodConfig } from "@/lib/types";

type PaymentBrand = Pick<PaymentMethodConfig | PaymentDetails, "type" | "name" | "bankCode">;

function brandKey(payment: PaymentBrand) {
  const value = `${payment.bankCode || ""} ${payment.name}`.toLowerCase();
  if (payment.type === "qris" || value.includes("qris")) return "qris";
  if (value.includes("blu")) return "blu";
  if (value.includes("sea")) return "seabank";
  if (value.includes("bca")) return "bca";
  return "bank";
}

export function PaymentLogo({ payment, compact = false }: { payment: PaymentBrand; compact?: boolean }) {
  const key = brandKey(payment);
  const size = compact ? "h-9 min-w-14 px-2.5 text-[12px]" : "h-12 min-w-20 px-3 text-sm";

  if (key === "bca") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0055a4] font-black tracking-[-0.02em] text-white shadow-sm ${size}`}>
        BCA
      </span>
    );
  }

  if (key === "blu") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0097e8,#005bea)] font-black tracking-[-0.04em] text-white shadow-sm ${size}`}>
        blu
      </span>
    );
  }

  if (key === "seabank") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ffb000,#ff6f00)] font-black tracking-[-0.04em] text-white shadow-sm ${size}`}>
        SeaBank
      </span>
    );
  }

  if (key === "qris") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#d8d0d2] bg-white font-black tracking-[0.08em] text-[#241b1e] shadow-sm ${size}`}>
        <QrCode className={compact ? "size-4" : "size-5"} /> QRIS
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[#4a1326] font-black text-white shadow-sm ${size}`}>
      BANK
    </span>
  );
}
