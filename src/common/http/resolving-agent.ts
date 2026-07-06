import * as https from 'https';
import { Resolver } from 'dns';

/**
 * Agente HTTPS que resolve DNS por conta própria (Cloudflare/Google) em vez de
 * depender do resolver do SO/ISP. Alguns provedores (ex.: ISP do usuário) falham
 * em resolver `*.api-sports.io` → getaddrinfo ENOTFOUND. Mantém o hostname para
 * SNI/certificado/Host; só troca a resolução do IP.
 */
const resolver = new Resolver();
resolver.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8']);

// O Node chama o lookup ora com options.all=true (espera array), ora simples.
const customLookup = (
  hostname: string,
  options: { all?: boolean } | number,
  cb: (err: Error | null, address: any, family?: number) => void,
): void => {
  resolver.resolve4(hostname, (err, addresses) => {
    if (err || !addresses?.length) {
      cb(err ?? new Error('DNS sem resposta'), '', 4);
      return;
    }
    if (typeof options === 'object' && options.all) {
      cb(
        null,
        addresses.map((address) => ({ address, family: 4 })),
      );
    } else {
      cb(null, addresses[0], 4);
    }
  });
};

/** Novo https.Agent com o resolver dedicado. */
export function createResolvingHttpsAgent(): https.Agent {
  return new https.Agent({ lookup: customLookup as never, keepAlive: true });
}
