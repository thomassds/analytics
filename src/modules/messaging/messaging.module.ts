import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUES,
  RABBITMQ_EMAIL_CLIENT,
  RABBITMQ_SMS_CLIENT,
} from './messaging.constants';
import { SendEmailProducer } from './producers/send-email.producer';
import { SendSmsProducer } from './producers/send-sms.producer';
import { EmailConsumer } from './consumers/email.consumer';
import { SmsConsumer } from './consumers/sms.consumer';
import { EMAIL_PRODUCER } from './contracts/email-producer.contract';
import { SMS_PRODUCER } from './contracts/sms-producer.contract';
import { MailerService } from './services/mailer.service';
import { TwilioService } from './services/twilio.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_EMAIL_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL') as string],
            queue: QUEUES.EMAIL_SEND,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: RABBITMQ_SMS_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL') as string],
            queue: QUEUES.SMS_SEND,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [EmailConsumer, SmsConsumer],
  providers: [
    { provide: EMAIL_PRODUCER, useClass: SendEmailProducer },
    { provide: SMS_PRODUCER, useClass: SendSmsProducer },
    MailerService,
    TwilioService,
  ],
  exports: [EMAIL_PRODUCER, SMS_PRODUCER],
})
export class MessagingModule {}
