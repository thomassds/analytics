import { SendEmailPayload } from '../types/email.types';

export const EMAIL_PRODUCER = 'EMAIL_PRODUCER';

export interface IEmailProducer {
  send(payload: SendEmailPayload): Promise<void>;
}
