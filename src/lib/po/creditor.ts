function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text === "" ? null : text;
}

/** Purchase VAT applies to creditor codes that start with 7. */
export function creditorHasPurchaseVat(code: string | null | undefined): boolean {
  return clean(code)?.startsWith("7") ?? false;
}

/**
 * A bill sometimes stores only the creditor code in the name field, and a
 * master row sometimes has the name when the bill does not.
 */
export function creditorIdentity(input: {
  code?: string | null;
  name?: string | null;
  masterName?: string | null;
}): { code: string | null; name: string | null } {
  const code = clean(input.code);
  const billName = clean(input.name);
  const masterName = clean(input.masterName);
  const name =
    billName && billName !== code
      ? billName
      : masterName && masterName !== code
        ? masterName
        : null;
  return { code, name };
}

export function purchaseVatIsBlank(tax: string | null | undefined): boolean {
  if (tax == null) return true;
  const text = tax.trim();
  if (text === "") return true;
  const amount = Number(text.replace(/,/g, ""));
  return !Number.isFinite(amount) || amount === 0;
}

/** Note for creditors outside the purchase-VAT book. Null when VAT applies. */
export function purchaseVatNote(
  code: string | null | undefined,
  tax: string | null | undefined
): string | null {
  if (creditorHasPurchaseVat(code)) return null;
  if (purchaseVatIsBlank(tax)) return "ไม่มีภาษีซื้อ — ใส่ 0 หรือเว้นว่างได้";
  return "รหัสไม่ขึ้นต้นด้วย 7 แต่ใบนี้มียอดภาษี";
}
