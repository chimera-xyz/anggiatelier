export const defaultQrisStaticPayload =
  "00020101021126610014COM.GO-JEK.WWW01189360091436762029880210G6762029880303UMI51440014ID.CO.QRIS.WWW0215ID10254004132540303UMI5204573253033605802ID5912iPhone Haven6013JAKARTA TIMUR61051341062070703A016304F93B";

export function crc16CcittFalse(data: string) {
  let crc = 0xffff;
  for (let index = 0; index < data.length; index += 1) {
    crc ^= data.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function removeTopLevelTags(payload: string, tags: Set<string>) {
  let cursor = 0;
  let next = "";
  while (cursor + 4 <= payload.length) {
    const tag = payload.slice(cursor, cursor + 2);
    const length = Number(payload.slice(cursor + 2, cursor + 4));
    const end = cursor + 4 + length;
    if (!Number.isInteger(length) || length < 0 || end > payload.length) return payload;
    if (!tags.has(tag)) next += payload.slice(cursor, end);
    cursor = end;
  }
  return cursor === payload.length ? next : payload;
}

function normalizeQrisPayload(payload: string) {
  return payload.trim().replace(/[\r\n\t]+/g, "");
}

export function getQrisMerchantName(payload: string) {
  const normalized = normalizeQrisPayload(payload);
  let cursor = 0;
  while (cursor + 4 <= normalized.length) {
    const tag = normalized.slice(cursor, cursor + 2);
    const length = Number(normalized.slice(cursor + 2, cursor + 4));
    const start = cursor + 4;
    const end = start + length;
    if (!Number.isInteger(length) || length < 0 || end > normalized.length) return "";
    if (tag === "59") return normalized.slice(start, end).trim();
    cursor = end;
  }
  return "";
}

export function generateDynamicQrisPayload(staticPayload: string, amount: number, enableTip = false) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Nominal QRIS harus lebih dari 0.");
  }

  const normalized = normalizeQrisPayload(staticPayload);
  const crcTagIndex = normalized.lastIndexOf("6304");
  if (crcTagIndex === -1) {
    throw new Error("Payload QRIS tidak valid: tag CRC 6304 tidak ditemukan.");
  }

  const basePayload = removeTopLevelTags(normalized.slice(0, crcTagIndex), new Set(["54", "55"]));
  const amountValue = String(amount);
  const amountTag = `54${amountValue.length.toString().padStart(2, "0")}${amountValue}`;
  const tipTag = enableTip ? "550201" : "";
  const payloadForCrc = `${basePayload}${amountTag}${tipTag}6304`;
  return `${payloadForCrc}${crc16CcittFalse(payloadForCrc)}`;
}
