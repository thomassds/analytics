/**
 * Imagens (bandeiras/escudos/avatares) passam pelo NOSSO proxy (ImageProxyController),
 * não pelo CDN direto — imune a DNS de ISP ruim / ad-blocker e esconde o provedor.
 * URL do proxy vem de MEDIA_PROXY_URL (prod = URL pública do backend); default local.
 */
const PROXY_BASE =
  process.env.MEDIA_PROXY_URL ?? 'http://localhost:3000/api/v1/img';

export function teamLogoUrl(externalRef?: string | null): string | null {
  return externalRef ? `${PROXY_BASE}/team/${externalRef}` : null;
}

export function playerPhotoUrl(externalRef?: string | null): string | null {
  return externalRef ? `${PROXY_BASE}/player/${externalRef}` : null;
}

export function leagueLogoUrl(externalRef?: string | null): string | null {
  return externalRef ? `${PROXY_BASE}/league/${externalRef}` : null;
}
