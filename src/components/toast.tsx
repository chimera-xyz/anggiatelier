"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";

export function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,430px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/20 bg-[#2d0b17] px-4 py-3 text-sm text-white shadow-2xl fade-up">
      {type === "success" ? <CheckCircle2 className="size-5 text-[#83d5aa]" /> : <CircleAlert className="size-5 text-[#ff9a9f]" />}
      <span className="flex-1 leading-5">{message}</span>
      <button onClick={onClose} className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Tutup">
        <X className="size-4" />
      </button>
    </div>
  );
}
