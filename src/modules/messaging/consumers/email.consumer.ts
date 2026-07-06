import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { SendEmailPayload } from '../types/email.types';
import { QUEUES } from '../messaging.constants';
import { MailerService } from '../services/mailer.service';
import { renderEmailTemplate } from '../templates/email-templates';

@Controller()
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(private readonly mailerService: MailerService) {}

  @EventPattern(QUEUES.EMAIL_SEND)
  async handle(@Payload() payload: SendEmailPayload): Promise<void> {
    this.logger.log(`[EMAIL] template=${payload.template} to=${payload.to}`);

    const { subject, html } = renderEmailTemplate(
      payload.template,
      payload.data,
    );

    try {
      await this.mailerService.send({ to: payload.to, subject, html });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email para ${payload.to}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
