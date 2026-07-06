import { SendSmsPayload } from '../types/sms.types';

export const SMS_PRODUCER = 'SMS_PRODUCER';

export interface ISmsProducer {
  send(payload: SendSmsPayload): Promise<void>;
}
