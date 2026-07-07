import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { AppError } from '../../common/errors/app-error';
import { isUuid } from '../../common/utils/uuid';
import { PlansService, UpsertPlanInput } from './plans.service';

@ApiTags('Billing')
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  /** Catálogo público de planos ativos (vitrine de preços do site B2C). */
  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Planos ativos (público)' })
  async listActive() {
    const data = await this.plans.list(false);
    return { success: true, data };
  }

  /* ---- Administração (backoffice) ---- */

  @PlatformAdmin()
  @Get('admin/plans')
  @ApiOperation({ summary: 'Todos os planos (admin)' })
  async listAll() {
    const data = await this.plans.list(true);
    return { success: true, data };
  }

  @PlatformAdmin()
  @Post('admin/plans')
  @ApiOperation({ summary: 'Criar plano (cria Product+Price na Stripe)' })
  async create(@Body() body: UpsertPlanInput) {
    const data = await this.plans.create(body);
    return { success: true, data };
  }

  @PlatformAdmin()
  @Put('admin/plans/:id')
  @ApiOperation({ summary: 'Editar plano' })
  async update(@Param('id') id: string, @Body() body: UpsertPlanInput) {
    if (!isUuid(id)) throw new AppError('VALIDATION_ERROR', 422);
    const data = await this.plans.update(id, body);
    return { success: true, data };
  }

  @PlatformAdmin()
  @Delete('admin/plans/:id')
  @ApiOperation({ summary: 'Arquivar plano' })
  async archive(@Param('id') id: string) {
    if (!isUuid(id)) throw new AppError('VALIDATION_ERROR', 422);
    await this.plans.archive(id);
    return { success: true, data: { archived: true } };
  }
}
