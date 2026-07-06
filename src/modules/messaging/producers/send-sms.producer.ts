import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { QUEUES, RABBITMQ_SMS_CLIENT } from '../messaging.constants';
import { SendSmsPayload } from '../types/sms.types';
import { ISmsProducer } from '../contracts/sms-producer.contract';

@Injectable()
export class SendSmsProducer implements ISmsProducer {
  private readonly logger = new Logger(SendSmsProducer.name);

  constructor(
    @Inject(RABBITMQ_SMS_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  async send(payload: SendSmsPayload): Promise<void> {
    this.logger.log(`Publishing sms/whatsapp to ${payload.to}`);
    this.client.emit(QUEUES.SMS_SEND, payload);
  }
}
