export const paymentWindowMinutes = 5;
export const paymentWindowMs = paymentWindowMinutes * 60_000;

export function formatPaymentDeadline(value: string | Date) {
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
