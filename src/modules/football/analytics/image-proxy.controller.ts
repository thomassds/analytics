import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import axios, { AxiosInstance } from 'axios';
import { createResolvingHttpsAgent } from '../../../common/http/resolving-agent';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Proxy das imagens do provedor (bandeiras/escudos/avatares).
 * O navegador carrega do NOSSO backend, não do CDN — imune a DNS de ISP ruim,
 * ad-blockers, e esconde o provedor (ACL). Cacheia forte no navegador.
 * DNS dedicado (Cloudflare/Google) via createResolvingHttpsAgent — funciona mesmo
 * quando o DNS do sistema não resolve `media.api-sports.io`.
 */
const KIND_FOLDER: Record<string, string> = {
  team: 'teams',
  player: 'players',
  league: 'leagues',
};

@Public()
@ApiTags('Media')
@Controller('img')
export class ImageProxyController {
  private readonly http: AxiosInstance = axios.create({
    responseType: 'arraybuffer',
    timeout: 15000,
    httpsAgent: createResolvingHttpsAgent(),
  });

  @Get(':kind/:ref')
  @ApiOperation({ summary: 'Proxy de imagem do provedor (team/player/league)' })
  async image(
    @Param('kind') kind: string,
    @Param('ref') ref: string,
    @Res() res: Response,
  ): Promise<void> {
    const folder = KIND_FOLDER[kind];
    // valida: tipo conhecido + ref numérico (evita SSRF/abuso)
    if (!folder || !/^\d+$/.test(ref)) {
      res.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    const url = `https://media.api-sports.io/football/${folder}/${ref}.png`;
    try {
      const r = await this.http.get<ArrayBuffer>(url);
      res.setHeader('Content-Type', String(r.headers['content-type'] ?? 'image/png'));
      // imutável: cada navegador baixa 1x só
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(HttpStatus.OK).send(Buffer.from(r.data));
    } catch {
      // 404 → o front cai no fallback (placeholder) sem quebrar
      res.status(HttpStatus.NOT_FOUND).end();
    }
  }
}
