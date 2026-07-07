import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AppError } from '../../common/errors/app-error';
import { BillingInterval, Plan } from './entities/plan.entity';
import { StripeService } from './stripe.service';

export interface UpsertPlanInput {
  name: string;
  description?: string | null;
  amountCents: number;
  currency?: string;
  interval?: BillingInterval;
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    private readonly stripe: StripeService,
  ) {}

  /** Lista planos; por padrão só os ativos (o backoffice pede todos). */
  list(includeInactive = false): Promise<Plan[]> {
    return this.plans.find({
      where: includeInactive ? {} : { active: true },
      order: { amountCents: 'ASC' },
    });
  }

  async getActiveById(id: string): Promise<Plan> {
    const plan = await this.plans.findOne({ where: { id, active: true } });
    if (!plan) throw new AppError('PLAN_NOT_FOUND', 404);
    return plan;
  }

  private validate(input: UpsertPlanInput): Required<UpsertPlanInput> {
    const name = (input.name ?? '').trim();
    if (!name) throw new AppError('VALIDATION_ERROR', 422);
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    const interval = input.interval ?? 'month';
    if (interval !== 'month' && interval !== 'year') {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    return {
      name,
      description: input.description?.trim() || null,
      amountCents: input.amountCents,
      currency: (input.currency ?? 'brl').toLowerCase(),
      interval,
    };
  }

  async create(input: UpsertPlanInput): Promise<Plan> {
    const v = this.validate(input);
    const { productId, priceId } = await this.stripe.createProductWithPrice(v);
    const plan = this.plans.create({
      ...v,
      stripeProductId: productId,
      stripePriceId: priceId,
      active: true,
    });
    return this.plans.save(plan);
  }

  async update(id: string, input: UpsertPlanInput): Promise<Plan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new AppError('PLAN_NOT_FOUND', 404);
    const v = this.validate(input);

    if (plan.stripeProductId) {
      await this.stripe.updateProduct(plan.stripeProductId, {
        name: v.name,
        description: v.description,
      });
      // preço mudou → cria Price novo na Stripe e arquiva o antigo
      const priceChanged =
        v.amountCents !== plan.amountCents ||
        v.currency !== plan.currency ||
        v.interval !== plan.interval;
      if (priceChanged) {
        plan.stripePriceId = await this.stripe.replacePrice({
          productId: plan.stripeProductId,
          oldPriceId: plan.stripePriceId,
          amountCents: v.amountCents,
          currency: v.currency,
          interval: v.interval,
        });
      }
    }

    Object.assign(plan, v);
    return this.plans.save(plan);
  }

  /** Arquiva (soft): inativa aqui e na Stripe; assinaturas existentes seguem. */
  async archive(id: string): Promise<void> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new AppError('PLAN_NOT_FOUND', 404);
    plan.active = false;
    await this.plans.save(plan);
    if (plan.stripeProductId) {
      await this.stripe.archiveProduct(plan.stripeProductId);
    }
  }

  findByStripePrice(priceId: string): Promise<Plan | null> {
    return this.plans.findOne({
      where: { stripePriceId: priceId, deletedAt: IsNull() },
    });
  }
}
