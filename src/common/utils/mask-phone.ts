export function maskPhone(
  phone: string | null | undefined,
  options?: { visibleStart?: number; visibleEnd?: number },
): string | null {
  if (!phone) return null;

  const visibleStart = options?.visibleStart ?? 2;
  const visibleEnd = options?.visibleEnd ?? 2;

  if (phone.length <= visibleStart + visibleEnd) {
    return '*'.repeat(phone.length);
  }

  const start = phone.slice(0, visibleStart);
  const end = phone.slice(-visibleEnd);
  const masked = '*'.repeat(phone.length - visibleStart - visibleEnd);

  return `${start}${masked}${end}`;
}

export function unmaskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}
