export type EmailTemplate =
  | 'validation-code'
  | 'contract-created'
  | 'contract-signed';

export interface SendEmailPayload {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}
