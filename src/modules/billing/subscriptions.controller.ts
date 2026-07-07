import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AppError } from '../../common/errors/app-error';
import { isUuid } from '../../common/utils/uuid';
import { User } from '../auth/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Billing')
@Controller()
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  /** Cliente logado inicia a assinatura → devolve a URL do Checkout da Stripe. */
  @Post('subscriptions/checkout')
  @ApiOperation({ summary: 'Criar sessão de checkout (cliente)' })
  async checkout(@AuthUser() user: User, @Body() body: { planId?: string }) {
    if (!body?.planId || !isUuid(body.planId)) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    const data = await this.subs.createCheckout(user, body.planId);
    return { success: true, data };
  }

  /** Assinatura atual do cliente logado. */
  @Get('subscriptions/me')
  @ApiOperation({ summary: 'Minha assinatura' })
  async mine(@AuthUser() user: User) {
    const data = await this.subs.getForUser(user.id);
    return { success: true, data };
  }

  /* ---- Administração (backoffice) ---- */

  @PlatformAdmin()
  @Get('admin/subscriptions')
  @ApiOperation({ summary: 'Todas as assinaturas (admin)' })
  async listAll() {
    const data = await this.subs.listAll();
    return { success: true, data };
  }

  @PlatformAdmin()
  @Post('admin/subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancelar assinatura (fim do período)' })
  async cancel(
    @Param('id') id: string,
    @Body() body: { immediately?: boolean },
  ) {
    if (!isUuid(id)) throw new AppError('VALIDATION_ERROR', 422);
    await this.subs.cancel(id, !body?.immediately);
    return { success: true, data: { canceled: true } };
  }
}
