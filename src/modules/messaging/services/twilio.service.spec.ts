import { ConfigService } from '@nestjs/config';
import { TwilioService } from './twilio.service';

const createConfig = (values: Record<string, string | undefined>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

describe('TwilioService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue({ ok: true });
  });

  it('sends SMS with From number', async () => {
    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+15550001111',
      }),
    );

    await service.send({ to: '+5511999999999', body: 'code 123', channel: 'sms' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/Accounts/AC123/Messages.json');
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('+5511999999999');
    expect(body.get('From')).toBe('+15550001111');
    expect(body.get('Body')).toBe('code 123');
  });

  it('prefixes whatsapp channel when TWILIO_WHATSAPP_NUMBER is set', async () => {
    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+15550001111',
        TWILIO_WHATSAPP_NUMBER: '+14155238886',
      }),
    );

    await service.send({ to: '+5511999999999', body: 'x', channel: 'whatsapp' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('whatsapp:+5511999999999');
    expect(body.get('From')).toBe('whatsapp:+14155238886');
  });

  it('falls back to SMS when whatsapp is requested without TWILIO_WHATSAPP_NUMBER', async () => {
    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+15550001111',
      }),
    );

    await service.send({ to: '+5511999999999', body: 'x', channel: 'whatsapp' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('+5511999999999');
    expect(body.get('From')).toBe('+15550001111');
  });

  it('prepends + when to has no plus sign', async () => {
    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+15550001111',
      }),
    );

    await service.send({ to: '5519997630723', body: 'x', channel: 'sms' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('+5519997630723');
  });

  it('uses MessagingServiceSid when configured', async () => {
    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_MESSAGING_SERVICE_SID: 'MG123',
      }),
    );

    await service.send({ to: '+5511999999999', body: 'x', channel: 'sms' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(options.body as string);
    expect(body.get('MessagingServiceSid')).toBe('MG123');
    expect(body.get('From')).toBeNull();
  });

  it('throws on Twilio API error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid number' }),
    });

    const service = new TwilioService(
      createConfig({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+15550001111',
      }),
    );

    await expect(
      service.send({ to: '+55119', body: 'x', channel: 'sms' }),
    ).rejects.toThrow('Twilio error 400: Invalid number');
  });

  it('logs only in dev mode without credentials', async () => {
    const service = new TwilioService(createConfig({}));

    await service.send({ to: '+5511999999999', body: 'x', channel: 'sms' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
