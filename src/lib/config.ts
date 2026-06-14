export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function isHostedDemoBrowser() {
  if (isSupabaseConfigured || typeof window === "undefined") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function usesLocalDemoBrowser() {
  if (isSupabaseConfigured || typeof window === "undefined") return false;
  return !isHostedDemoBrowser();
}

export const adminWhatsApp = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || "6281234567890";
export const demoAdminPin = process.env.NEXT_PUBLIC_DEMO_ADMIN_PIN || "1234";
export const bankAccount = {
  bank: process.env.NEXT_PUBLIC_BANK_NAME || "BCA",
  number: process.env.NEXT_PUBLIC_BANK_ACCOUNT || "1234567890",
  holder: process.env.NEXT_PUBLIC_BANK_HOLDER || "ANGGI ATELIER",
};
