import {
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../../common/decorators/public.decorator';
import { AppError } from '../../common/errors/app-error';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Recebe eventos da Stripe e mantém as assinaturas locais em sincronia.
 * Público (a Stripe não manda JWT) — a autenticidade vem da assinatura do webhook,
 * validada com o corpo CRU (por isso rawBody).
 */
@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Public()
  @Post('stripe')
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) throw new AppError('INVALID_WEBHOOK', 400);

    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(req.rawBody, signature);
    } catch (e: any) {
      this.logger.warn(`Assinatura inválida do webhook: ${e?.message}`);
      throw new AppError('INVALID_WEBHOOK_SIGNATURE', 400);
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.subs.syncFromStripe(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription) {
            const sub = await this.stripe.getSubscription(
              session.subscription as string,
            );
            await this.subs.syncFromStripe(sub);
          }
          break;
        }
        default:
          break; // ignora o resto
      }
    } catch (e: any) {
      this.logger.error(`Falha ao processar ${event.type}: ${e?.message}`);
      // 200 mesmo assim: evita retries infinitos por erro nosso; logamos.
    }

    return { received: true };
  }
}
