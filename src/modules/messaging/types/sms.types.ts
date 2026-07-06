export interface SendSmsPayload {
  to: string;
  code: string;
  channel: 'sms' | 'whatsapp';
}
