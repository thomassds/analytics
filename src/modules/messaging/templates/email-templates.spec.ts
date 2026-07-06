import { renderEmailTemplate } from './email-templates';

describe('renderEmailTemplate', () => {
  it('renders validation-code with the code', () => {
    const result = renderEmailTemplate('validation-code', { code: '123456' });

    expect(result.subject).toBe('Seu código de verificação');
    expect(result.html).toContain('123456');
    expect(result.html).toContain('expira em 1 hora');
  });

  it('renders contract-created with client name', () => {
    const result = renderEmailTemplate('contract-created', {
      clientName: 'João',
    });

    expect(result.subject).toBe('Novo contrato criado');
    expect(result.html).toContain('João');
  });

  it('renders contract-signed with contract id', () => {
    const result = renderEmailTemplate('contract-signed', {
      contractId: 'abc-123',
    });

    expect(result.subject).toBe('Contrato assinado');
    expect(result.html).toContain('abc-123');
  });

  it('throws for unknown template', () => {
    expect(() =>
      renderEmailTemplate('unknown' as never, {}),
    ).toThrow('Unknown email template');
  });
});
