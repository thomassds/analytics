import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendSmsInput {
  to: string;
  body: string;
  channel: 'sms' | 'whatsapp';
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly messagingServiceSid?: string;
  private readonly phoneNumber?: string;
  private readonly whatsappNumber?: string;

  constructor(config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = config.get<string>('TWILIO_AUTH_TOKEN');
    this.messagingServiceSid = config.get<string>(
      'TWILIO_MESSAGING_SERVICE_SID',
    );
    this.phoneNumber = config.get<string>('TWILIO_PHONE_NUMBER');
    this.whatsappNumber = config.get<string>('TWILIO_WHATSAPP_NUMBER');

    if (!this.accountSid || !this.authToken) {
      this.logger.warn(
        'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN não configurados — SMS serão apenas logados (modo dev)',
      );
    }
  }

  async send(input: SendSmsInput): Promise<void> {
    if (!this.accountSid || !this.authToken) {
      this.logger.log(
        `[DEV] ${input.channel.toUpperCase()} para ${input.to}: ${input.body}`,
      );
      return;
    }

    let channel = input.channel;
    if (channel === 'whatsapp' && !this.whatsappNumber) {
      this.logger.warn(
        'TWILIO_WHATSAPP_NUMBER não configurado — enviando como SMS',
      );
      channel = 'sms';
    }

    const to = input.to.startsWith('+') ? input.to : `+${input.to}`;
    const params = new URLSearchParams({ Body: input.body });

    if (channel === 'whatsapp') {
      params.set('To', `whatsapp:${to}`);
      params.set('From', `whatsapp:${this.whatsappNumber}`);
    } else {
      params.set('To', to);
      if (this.messagingServiceSid) {
        params.set('MessagingServiceSid', this.messagingServiceSid);
      } else if (this.phoneNumber) {
        params.set('From', this.phoneNumber);
      } else {
        throw new Error(
          'Configure TWILIO_MESSAGING_SERVICE_SID ou TWILIO_PHONE_NUMBER',
        );
      }
    }

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      'base64',
    );

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        `Twilio error ${response.status}: ${error.message ?? 'unknown'}`,
      );
    }

    this.logger.log(`${channel.toUpperCase()} enviado para ${to}`);
  }
}
