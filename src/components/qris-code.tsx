"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LoaderCircle, QrCode } from "lucide-react";

export function QrisCode({ payload, label }: { payload: string; label: string }) {
  const [result, setResult] = useState<{ payload: string; src: string; error: string }>({ payload: "", src: "", error: "" });

  useEffect(() => {
    let active = true;

    import("qrcode")
      .then((module) =>
        module.toDataURL(payload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 240,
          color: { dark: "#241b1e", light: "#fffaf6" },
        }),
      )
      .then((dataUrl) => {
        if (active) setResult({ payload, src: dataUrl, error: "" });
      })
      .catch((reason) => {
        if (active) setResult({ payload, src: "", error: reason instanceof Error ? reason.message : "QRIS gagal dibuat." });
      });

    return () => {
      active = false;
    };
  }, [payload]);

  const pending = result.payload !== payload;

  if (!pending && result.error) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-[#efc7cc] bg-[#fff6f7] p-5 text-center text-xs text-[#9a3451]">
        <div>
          <QrCode className="mx-auto mb-2 size-7" />
          {result.error}
        </div>
      </div>
    );
  }

  if (pending || !result.src) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-[#eadedd] bg-[#fff9f7] text-[#a33c5b]">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#eadedd] bg-[#fffaf6] p-4 text-center">
      <Image src={result.src} alt={label} width={240} height={240} unoptimized className="mx-auto size-60 max-w-full rounded-xl" />
      <p className="mt-3 text-[11px] font-semibold text-[#756a6e]">{label}</p>
    </div>
  );
}
