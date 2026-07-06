/**
 * Monta o número em formato E.164 (+5511999999999) a partir do
 * country code e do telefone salvos sem máscara.
 * Se o country code estiver ausente, retorna o telefone como está.
 */
export function toE164(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  const cc = countryCode?.replace(/\D/g, '');

  if (!cc) return digits;

  return `+${cc}${digits}`;
}
