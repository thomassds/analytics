import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { AppError } from '../../common/errors/app-error';
import { User } from '../auth/entities/user.entity';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { PlansService } from './plans.service';
import { StripeService } from './stripe.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly plans: PlansService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  /** Cria a sessão de checkout hospedado da Stripe e devolve a URL de redirect. */
  async createCheckout(
    user: User,
    planId: string,
  ): Promise<{ url: string | null }> {
    const plan = await this.plans.getActiveById(planId);
    if (!plan.stripePriceId) throw new AppError('PLAN_NOT_ON_STRIPE', 422);

    const customerId = await this.stripe.getOrCreateCustomer({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    const base =
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3001';
    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      userId: user.id,
      successUrl: `${base}/assinatura/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/assinatura/cancelado`,
    });
    return { url: session.url };
  }

  /** Assinatura atual do usuário (a mais recente). */
  getForUser(userId: string): Promise<Subscription | null> {
    return this.subs.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Lista para o backoffice: assinatura + dados do cliente + nome do plano. */
  async listAll(): Promise<
    Array<
      Subscription & { userName: string; userEmail: string; planName: string | null }
    >
  > {
    const rows = await this.subs
      .createQueryBuilder('s')
      .leftJoin(User, 'u', 'u.id = s.user_id')
      .leftJoin('plans', 'p', 'p.id = s.plan_id')
      .addSelect('u.name', 's_user_name')
      .addSelect('u.email', 's_user_email')
      .addSelect('p.name', 's_plan_name')
      .orderBy('s.created_at', 'DESC')
      .getRawAndEntities();

    return rows.entities.map((s, i) => ({
      ...s,
      userName: rows.raw[i]?.s_user_name ?? '',
      userEmail: rows.raw[i]?.s_user_email ?? '',
      planName: rows.raw[i]?.s_plan_name ?? null,
    }));
  }

  /** Cancela na Stripe; o estado local é confirmado pelo webhook. */
  async cancel(id: string, atPeriodEnd = true): Promise<void> {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new AppError('SUBSCRIPTION_NOT_FOUND', 404);
    await this.stripe.cancelSubscription(sub.stripeSubscriptionId, atPeriodEnd);
    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
      await this.subs.save(sub);
    }
  }

  /** Upsert local a partir de uma Subscription da Stripe (chamado pelo webhook). */
  async syncFromStripe(sub: Stripe.Subscription): Promise<void> {
    const item = sub.items.data[0];
    const priceId = item?.price?.id ?? null;
    const plan = priceId ? await this.plans.findByStripePrice(priceId) : null;

    const existing = await this.subs.findOne({
      where: { stripeSubscriptionId: sub.id },
    });
    const userId =
      (sub.metadata?.userId as string | undefined) ?? existing?.userId ?? null;
    if (!userId) return; // sem vínculo de usuário não há o que espelhar

    const toDate = (unix: number | null | undefined): Date | null =>
      unix ? new Date(unix * 1000) : null;

    const record: Partial<Subscription> = {
      userId,
      planId: plan?.id ?? existing?.planId ?? null,
      stripeCustomerId:
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      status: sub.status as SubscriptionStatus,
      // no modelo novo da Stripe o período de cobrança vive no item, não no topo
      currentPeriodStart: toDate(item?.current_period_start),
      currentPeriodEnd: toDate(item?.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };

    if (existing) {
      await this.subs.update(existing.id, record);
    } else {
      await this.subs.save(this.subs.create(record));
    }
  }
}
