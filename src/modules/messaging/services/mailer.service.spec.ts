import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createConfig = (values: Record<string, string | undefined>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

describe('MailerService', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('creates transport with known service (Gmail)', () => {
    const service = new MailerService(
      createConfig({
        EMAIL_SERVICE: 'Gmail',
        EMAIL_ADDRESS: 'admin@test.com',
        EMAIL_PASSWORD: 'secret',
      }),
    );

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'Gmail',
      auth: { user: 'admin@test.com', pass: 'secret' },
    });
    expect(service).toBeDefined();
  });

  it('creates SMTP transport when only SMTP_HOST is set', () => {
    new MailerService(
      createConfig({
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        EMAIL_ADDRESS: 'a@b.com',
        EMAIL_PASSWORD: 'x',
      }),
    );

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.com',
      port: 465,
      secure: true,
      auth: { user: 'a@b.com', pass: 'x' },
    });
  });

  it('sends email with from, to, subject and html', async () => {
    const service = new MailerService(
      createConfig({
        EMAIL_SERVICE: 'Gmail',
        EMAIL_ADDRESS: 'admin@test.com',
        EMAIL_PASSWORD: 'secret',
        EMAIL_FROM: 'Vanz <admin@test.com>',
      }),
    );

    await service.send({ to: 'user@test.com', subject: 'Oi', html: '<p>x</p>' });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Vanz <admin@test.com>',
      to: 'user@test.com',
      subject: 'Oi',
      html: '<p>x</p>',
    });
  });

  it('does not create transport without config (dev mode)', async () => {
    const service = new MailerService(createConfig({}));

    await service.send({ to: 'user@test.com', subject: 'Oi', html: 'x' });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
