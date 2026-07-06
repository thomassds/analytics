import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AppError } from '../../../common/errors/app-error';
import { isUuid } from '../../../common/utils/uuid';
import { CatalogRepository } from '../repositories/catalog.repository';
import { GetMatchDetailUseCase } from './get-match-detail.use-case';

/**
 * Catálogo de dados PÚBLICOS de futebol (competições e partidas) — leitura sem
 * login. O gate de autenticação virá quando existir fluxo de login no front.
 */
@Public()
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly getMatchDetail: GetMatchDetailUseCase,
  ) {}

  @Get('competitions')
  @ApiOperation({ summary: 'Listar competições (para o filtro)' })
  async competitions() {
    const data = await this.catalog.listCompetitions();
    return { success: true, data };
  }

  @Get('leagues')
  @ApiOperation({
    summary: 'Listar ligas com jogos (filtro da home, ordenado por relevância)',
  })
  async leagues(@Query('scope') scope?: string) {
    if (scope !== undefined && scope !== 'upcoming' && scope !== 'past') {
      throw new AppError('INVALID_FILTER', 422);
    }
    const data = await this.catalog.listLeagues(
      scope as 'upcoming' | 'past' | undefined,
    );
    return { success: true, data };
  }

  @Get('leagues/:id/seasons')
  @ApiOperation({ summary: 'Edições (temporadas) de uma liga com jogos no escopo' })
  async leagueSeasons(@Param('id') id: string, @Query('scope') scope?: string) {
    if (!isUuid(id)) throw new AppError('VALIDATION_ERROR', 422);
    if (scope !== undefined && scope !== 'upcoming' && scope !== 'past') {
      throw new AppError('INVALID_FILTER', 422);
    }
    const data = await this.catalog.listLeagueSeasons(
      id,
      scope as 'upcoming' | 'past' | undefined,
    );
    return { success: true, data };
  }

  @Get('matches')
  @ApiOperation({
    summary: 'Listar partidas (filtro por liga/competição/escopo, paginado)',
  })
  async matches(
    @Query('competitionId') competitionId?: string,
    @Query('leagueId') leagueId?: string,
    @Query('scope') scope?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (competitionId !== undefined && !isUuid(competitionId)) {
      throw new AppError('INVALID_FILTER', 422);
    }
    if (leagueId !== undefined && !isUuid(leagueId)) {
      throw new AppError('INVALID_FILTER', 422);
    }
    if (scope !== undefined && scope !== 'upcoming' && scope !== 'past') {
      throw new AppError('INVALID_FILTER', 422);
    }
    const data = await this.catalog.listMatches({
      competitionId,
      leagueId,
      scope: scope as 'upcoming' | 'past' | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, data };
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Detalhe da partida + eventos (escalação, gols, cartões)' })
  async matchDetail(@Param('id') id: string) {
    if (!isUuid(id)) throw new AppError('VALIDATION_ERROR', 422);
    const data = await this.getMatchDetail.execute(id);
    return { success: true, data };
  }
}
