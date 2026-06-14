import Link from "next/link";

export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <Link href="/shop" className="inline-flex flex-col leading-none" aria-label="Anggi Atelier">
      <span
        className={`font-display font-semibold tracking-[-0.02em] ${compact ? "text-[27px]" : "text-[34px]"} ${light ? "text-[#fff8f2]" : "text-[#4a1326]"}`}
      >
        Anggi Atelier
      </span>
      {!compact ? (
        <span className={`mt-1 text-[9px] font-bold tracking-[0.38em] ${light ? "text-[#e9a4b7]" : "text-[#9f5269]"}`}>
          LIVE FASHION EDIT
        </span>
      ) : null}
    </Link>
  );
}
