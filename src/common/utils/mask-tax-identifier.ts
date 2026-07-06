export function maskTaxIdentifier(
  taxIdentifier: string | null | undefined,
  options?: { visibleStart?: number; visibleEnd?: number },
): string | null {
  if (!taxIdentifier) return null;

  const digits = taxIdentifier.replace(/\D/g, '');

  const visibleStart = options?.visibleStart ?? 3;
  const visibleEnd = options?.visibleEnd ?? 2;

  let masked: string;
  if (digits.length <= visibleStart + visibleEnd) {
    masked = '*'.repeat(digits.length);
  } else {
    const start = digits.slice(0, visibleStart);
    const end = digits.slice(-visibleEnd);
    masked = `${start}${'*'.repeat(digits.length - visibleStart - visibleEnd)}${end}`;
  }

  if (digits.length === 11) {
    // CPF: XXX.XXX.XXX-XX
    return `${masked.slice(0, 3)}.${masked.slice(3, 6)}.${masked.slice(6, 9)}-${masked.slice(9)}`;
  }

  if (digits.length === 14) {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    return `${masked.slice(0, 2)}.${masked.slice(2, 5)}.${masked.slice(5, 8)}/${masked.slice(8, 12)}-${masked.slice(12)}`;
  }

  return masked;
}

export function unmaskTaxIdentifier(
  masked: string | null | undefined,
): string | null {
  if (!masked) return null;

  return masked.replace(/\D/g, '');
}
