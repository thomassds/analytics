import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const service = this.config.get<string>('EMAIL_SERVICE');
    const address = this.config.get<string>('EMAIL_ADDRESS');
    const host = this.config.get<string>('SMTP_HOST');

    this.from =
      this.config.get<string>('EMAIL_FROM') ??
      address ??
      'Vanz <no-reply@vanz.app>';

    if (service && address) {
      // Provedor conhecido do nodemailer (ex: Gmail)
      this.transporter = nodemailer.createTransport({
        service,
        auth: {
          user: address,
          pass: this.config.get<string>('EMAIL_PASSWORD'),
        },
      });
      return;
    }

    if (host) {
      // SMTP genérico
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: address,
          pass: this.config.get<string>('EMAIL_PASSWORD'),
        },
      });
      return;
    }

    this.logger.warn(
      'EMAIL_SERVICE/SMTP_HOST não configurados — emails serão apenas logados (modo dev)',
    );
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[DEV] Email para ${input.to} | assunto: "${input.subject}"`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    this.logger.log(`Email enviado para ${input.to}`);
  }
}
