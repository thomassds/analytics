import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { QUEUES } from '../modules/messaging/messaging.constants';

export const rabbitMQMicroservices: MicroserviceOptions[] = [
  {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
      queue: QUEUES.EMAIL_SEND,
      queueOptions: { durable: true },
      noAck: false,
    },
  },
  {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
      queue: QUEUES.SMS_SEND,
      queueOptions: { durable: true },
      noAck: false,
    },
  },
];
