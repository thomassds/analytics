import { EmailTemplate } from '../types/email.types';

export interface RenderedEmail {
  subject: string;
  html: string;
}

type TemplateData = Record<string, unknown>;

const baseLayout = (content: string): string => `
<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td>
                <h2 style="margin:0 0 16px;color:#1a1a2e;">Vanz</h2>
                ${content}
                <p style="margin:24px 0 0;color:#9a9aa5;font-size:12px;">
                  Se você não solicitou este email, ignore esta mensagem.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const templates: Record<EmailTemplate, (data: TemplateData) => RenderedEmail> =
  {
    'validation-code': (data) => ({
      subject: 'Seu código de verificação',
      html: baseLayout(`
        <p style="color:#4a4a5a;font-size:14px;">Use o código abaixo para confirmar seu email:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;margin:16px 0;">${String(data.code ?? '')}</p>
        <p style="color:#4a4a5a;font-size:13px;">O código expira em 1 hora.</p>
      `),
    }),
    'contract-created': (data) => ({
      subject: 'Novo contrato criado',
      html: baseLayout(`
        <p style="color:#4a4a5a;font-size:14px;">Um novo contrato foi criado para você${data.clientName ? `, ${String(data.clientName)}` : ''}.</p>
        <p style="color:#4a4a5a;font-size:14px;">Acesse a plataforma para ver os detalhes.</p>
      `),
    }),
    'contract-signed': (data) => ({
      subject: 'Contrato assinado',
      html: baseLayout(`
        <p style="color:#4a4a5a;font-size:14px;">O contrato${data.contractId ? ` <strong>${String(data.contractId)}</strong>` : ''} foi assinado com sucesso.</p>
      `),
    }),
  };

export function renderEmailTemplate(
  template: EmailTemplate,
  data: TemplateData,
): RenderedEmail {
  const render = templates[template];
  if (!render) {
    throw new Error(`Unknown email template: ${template}`);
  }
  return render(data);
}
