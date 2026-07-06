import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { SendSmsPayload } from '../types/sms.types';
import { QUEUES } from '../messaging.constants';
import { TwilioService } from '../services/twilio.service';

@Controller()
export class SmsConsumer {
  private readonly logger = new Logger(SmsConsumer.name);

  constructor(private readonly twilioService: TwilioService) {}

  @EventPattern(QUEUES.SMS_SEND)
  async handle(@Payload() payload: SendSmsPayload): Promise<void> {
    this.logger.log(
      `[${payload.channel.toUpperCase()}] Sending code to ${payload.to}`,
    );

    try {
      await this.twilioService.send({
        to: payload.to,
        channel: payload.channel,
        body: `Vanz: seu codigo de verificacao e ${payload.code}. Expira em 1 hora.`,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar ${payload.channel} para ${payload.to}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
