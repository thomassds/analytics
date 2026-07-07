import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AppError } from '../../common/errors/app-error';
import { BillingInterval } from './entities/plan.entity';

/**
 * Wrapper fino sobre a SDK da Stripe. Cliente é lazy: a aplicação sobe mesmo sem
 * STRIPE_SECRET_KEY; só quebra (com erro claro) se uma rota de billing for usada
 * sem a chave configurada.
 */
@Injectable()
export class StripeService {
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  private get stripe(): Stripe {
    if (this.client) return this.client;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new AppError('STRIPE_NOT_CONFIGURED', 503);
    this.client = new Stripe(key);
    return this.client;
  }

  /** Cria Product + Price recorrente para um plano novo. */
  async createProductWithPrice(input: {
    name: string;
    description?: string | null;
    amountCents: number;
    currency: string;
    interval: BillingInterval;
  }): Promise<{ productId: string; priceId: string }> {
    const product = await this.stripe.products.create({
      name: input.name,
      description: input.description ?? undefined,
    });
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: input.amountCents,
      currency: input.currency,
      recurring: { interval: input.interval },
    });
    return { productId: product.id, priceId: price.id };
  }

  async updateProduct(
    productId: string,
    data: { name?: string; description?: string | null; active?: boolean },
  ): Promise<void> {
    await this.stripe.products.update(productId, {
      name: data.name,
      description: data.description ?? undefined,
      active: data.active,
    });
  }

  /**
   * Preços na Stripe são imutáveis: mudar valor = criar um Price novo e arquivar o
   * antigo. Retorna o id do novo price (assinaturas existentes seguem no antigo).
   */
  async replacePrice(input: {
    productId: string;
    oldPriceId: string | null;
    amountCents: number;
    currency: string;
    interval: BillingInterval;
  }): Promise<string> {
    const price = await this.stripe.prices.create({
      product: input.productId,
      unit_amount: input.amountCents,
      currency: input.currency,
      recurring: { interval: input.interval },
    });
    if (input.oldPriceId) {
      await this.stripe.prices
        .update(input.oldPriceId, { active: false })
        .catch(() => undefined);
    }
    return price.id;
  }

  async archiveProduct(productId: string): Promise<void> {
    await this.stripe.products
      .update(productId, { active: false })
      .catch(() => undefined);
  }

  /** Acha (por email) ou cria o Customer da Stripe para um usuário. */
  async getOrCreateCustomer(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<string> {
    const found = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
    const created = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    return created.id;
  }

  /** Sessão de Checkout hospedado (modo assinatura). Retorna a URL de redirect. */
  async createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string | null }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      subscription_data: { metadata: { userId: input.userId } },
    });
    return { id: session.id, url: session.url };
  }

  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<void> {
    if (atPeriodEnd) {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await this.stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async getSubscription(id: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(id);
  }

  /** Valida a assinatura do webhook e devolve o evento tipado. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new AppError('STRIPE_NOT_CONFIGURED', 503);
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
