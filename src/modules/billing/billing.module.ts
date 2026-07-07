import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { StripeService } from './stripe.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { PlansController } from './plans.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, Subscription, User])],
  controllers: [
    PlansController,
    SubscriptionsController,
    StripeWebhookController,
  ],
  providers: [StripeService, PlansService, SubscriptionsService],
})
export class BillingModule {}
