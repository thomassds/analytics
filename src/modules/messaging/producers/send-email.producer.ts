import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { QUEUES, RABBITMQ_EMAIL_CLIENT } from '../messaging.constants';
import { SendEmailPayload } from '../types/email.types';
import { IEmailProducer } from '../contracts/email-producer.contract';

@Injectable()
export class SendEmailProducer implements IEmailProducer {
  private readonly logger = new Logger(SendEmailProducer.name);

  constructor(
    @Inject(RABBITMQ_EMAIL_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  async send(payload: SendEmailPayload): Promise<void> {
    this.logger.log(`Publishing email to ${payload.to}`);
    this.client.emit(QUEUES.EMAIL_SEND, payload);
  }
}
