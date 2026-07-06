/**
 * Nomes de fila dirigidos por env (default `analytics.*`) para desacoplar do
 * projeto de origem. Mesmo RabbitMQ, filas próprias — fácil de migrar depois:
 * basta apontar RABBITMQ_EMAIL_QUEUE / RABBITMQ_SMS_QUEUE (ou trocar o RABBITMQ_URL).
 */
export const QUEUES = {
  EMAIL_SEND: process.env.RABBITMQ_EMAIL_QUEUE ?? 'analytics.email.send',
  SMS_SEND: process.env.RABBITMQ_SMS_QUEUE ?? 'analytics.sms.send',
} as const;

export const RABBITMQ_EMAIL_CLIENT = 'RABBITMQ_EMAIL_CLIENT';
export const RABBITMQ_SMS_CLIENT = 'RABBITMQ_SMS_CLIENT';
