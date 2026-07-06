import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OnboardingUseCase } from './use-cases/onboarding.use-case';
import { RequestCodeUseCase } from './use-cases/request-code.use-case';
import { ValidateCodeUseCase } from './use-cases/validate-code.use-case';
import { SavePersonalDataUseCase } from './use-cases/save-personal-data.use-case';
import { RecoveryPasswordUseCase } from './use-cases/recovery-password.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { CreateUserDtoSchema } from './dtos/create-user.dto';
import { RequestCodeDtoSchema } from './dtos/request-code.dto';
import { ValidateCodeDtoSchema } from './dtos/validate-code.dto';
import { PersonalDataDtoSchema } from './dtos/personal-data.dto';
import { RecoveryPasswordDtoSchema } from './dtos/recovery-password.dto';
import { LoginDtoSchema } from './dtos/login.dto';
import { AppError } from '../../common/errors/app-error';
import {
  errorSchema,
  successSchema,
} from '../../common/swagger/swagger-schemas';

@Public()
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly onboardingUseCase: OnboardingUseCase,
    private readonly requestCodeUseCase: RequestCodeUseCase,
    private readonly validateCodeUseCase: ValidateCodeUseCase,
    private readonly savePersonalDataUseCase: SavePersonalDataUseCase,
    private readonly recoveryPasswordUseCase: RecoveryPasswordUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário com email e senha' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'joao@email.com' },
        password: { type: 'string', example: 'Senha123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário autenticado com sucesso.',
    schema: successSchema({
      accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
          },
          name: { type: 'string', example: 'Joao Silva' },
          email: { type: 'string', example: 'joao@email.com' },
          taxIdentifier: {
            type: 'string',
            nullable: true,
            example: '123******01',
          },
          phone: {
            type: 'string',
            nullable: true,
            example: '11***********9',
          },
          validatedEmailAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          validatedPhoneAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
    }),
  })
  @ApiResponse({
    status: 404,
    description: 'USER_NOT_FOUND',
    schema: errorSchema('USER_NOT_FOUND', 'USER_NOT_FOUND'),
  })
  @ApiResponse({
    status: 403,
    description: 'EMAIL_NOT_VALIDATED',
    schema: errorSchema('EMAIL_NOT_VALIDATED', 'EMAIL_NOT_VALIDATED'),
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_CREDENTIALS | VALIDATION_ERROR',
    schema: errorSchema('INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR | INVALID_EMAIL_FORMAT',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async login(@Body() body: unknown) {
    const result = LoginDtoSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new AppError(firstIssue.message ?? 'VALIDATION_ERROR', 422);
    }

    const data = await this.loginUseCase.execute(result.data);
    return { success: true, data };
  }

  @Post('onboarding')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Step 1 — Criar conta (nome, email, senha)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: { type: 'string', example: 'Joao Silva' },
        email: { type: 'string', example: 'joao@email.com' },
        password: { type: 'string', example: 'Senha123' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Conta criada. Código de validação enviado por email.',
    schema: successSchema({
      userId: {
        type: 'string',
        example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
      },
    }),
  })
  @ApiResponse({
    status: 409,
    description: 'EMAIL_ALREADY_EXISTS',
    schema: errorSchema('EMAIL_ALREADY_EXISTS', 'EMAIL_ALREADY_EXISTS'),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async onboarding(@Body() body: unknown) {
    const result = CreateUserDtoSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new AppError(firstIssue.message ?? 'VALIDATION_ERROR', 422);
    }
    const data = await this.onboardingUseCase.execute(result.data);
    return { success: true, data };
  }

  @Post('request-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código de validação (email ou telefone)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['channel'],
      properties: {
        userId: {
          type: 'string',
          example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
        },
        email: { type: 'string', example: 'joao@email.com' },
        phone: { type: 'string', example: '11999999999' },
        channel: { type: 'string', enum: ['email', 'phone'], example: 'email' },
      },
      description:
        'Informe userId OU o identificador do canal selecionado (email para channel=email, phone para channel=phone).',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Código enviado com sucesso.',
    schema: successSchema({
      sent: { type: 'boolean', example: true },
      userId: {
        type: 'string',
        example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
      },
    }),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async requestCode(@Body() body: unknown) {
    const result = RequestCodeDtoSchema.safeParse(body);
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    const data = await this.requestCodeUseCase.execute(result.data);
    return { success: true, data };
  }

  @Post('validate-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar código recebido por email ou telefone' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'type', 'code'],
      properties: {
        userId: {
          type: 'string',
          example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
        },
        type: { type: 'string', enum: ['email', 'phone'], example: 'email' },
        code: { type: 'string', example: '123456' },
        justCheck: {
          type: 'boolean',
          example: true,
          default: false,
          description:
            'Quando true, apenas valida o código sem consumi-lo e sem atualizar validação do usuário.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Código validado com sucesso.',
    schema: successSchema({
      validated: { type: 'boolean', example: true },
      userId: {
        type: 'string',
        example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
      },
      type: { type: 'string', enum: ['email', 'phone'], example: 'email' },
    }),
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_CODE | CODE_EXPIRED | CODE_MAX_ATTEMPTS_EXCEEDED',
    schema: errorSchema('INVALID_CODE', 'INVALID_CODE'),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async validateCode(@Body() body: unknown) {
    const result = ValidateCodeDtoSchema.safeParse(body);
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    const data = await this.validateCodeUseCase.execute(result.data);
    return { success: true, data };
  }

  @Post('recovery-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recuperar senha com código de validação',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'type', 'code', 'password'],
      properties: {
        userId: {
          type: 'string',
          example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
        },
        type: { type: 'string', enum: ['email', 'phone'], example: 'email' },
        code: { type: 'string', example: '123456' },
        password: { type: 'string', example: 'NovaSenha123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Senha atualizada com sucesso.',
    schema: successSchema({
      updated: { type: 'boolean', example: true },
    }),
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_CODE | CODE_EXPIRED | CODE_MAX_ATTEMPTS_EXCEEDED',
    schema: errorSchema('INVALID_CODE', 'INVALID_CODE'),
  })
  @ApiResponse({
    status: 404,
    description: 'USER_NOT_FOUND',
    schema: errorSchema('USER_NOT_FOUND', 'USER_NOT_FOUND'),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR | WEAK_PASSWORD',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async recoveryPassword(@Body() body: unknown) {
    const result = RecoveryPasswordDtoSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new AppError(firstIssue.message ?? 'VALIDATION_ERROR', 422);
    }
    const data = await this.recoveryPasswordUseCase.execute(result.data);
    return { success: true, data };
  }

  @Post('onboarding/personal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 2 — Salvar dados pessoais e disparar validação de telefone',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'userId',
        'taxIdentifier',
        'phone',
        'countryCode',
        'zipCode',
        'street',
        'neighborhood',
        'city',
        'state',
        'number',
      ],
      properties: {
        userId: {
          type: 'string',
          example: '95d0582f-f9a5-4a79-b8cb-620cf5ce65c4',
        },
        taxIdentifier: { type: 'string', example: '12345678901' },
        phone: { type: 'string', example: '11999999999' },
        countryCode: { type: 'string', example: '55' },
        zipCode: { type: 'string', example: '01310100' },
        street: { type: 'string', example: 'Avenida Paulista' },
        neighborhood: { type: 'string', example: 'Bela Vista' },
        city: { type: 'string', example: 'Sao Paulo' },
        state: { type: 'string', example: 'SP' },
        number: { type: 'string', example: '1000' },
        complement: { type: 'string', example: 'Apto 101' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dados salvos. Código enviado por WhatsApp.',
    schema: successSchema({
      sent: { type: 'boolean', example: true },
    }),
  })
  @ApiResponse({
    status: 400,
    description: 'EMAIL_NOT_VALIDATED | PHONE_ALREADY_EXISTS',
    schema: errorSchema('EMAIL_NOT_VALIDATED', 'EMAIL_NOT_VALIDATED'),
  })
  @ApiResponse({
    status: 422,
    description: 'VALIDATION_ERROR',
    schema: errorSchema('VALIDATION_ERROR', 'VALIDATION_ERROR'),
  })
  async personalData(@Body() body: unknown) {
    const result = PersonalDataDtoSchema.safeParse(body);
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    const data = await this.savePersonalDataUseCase.execute(result.data);
    return { success: true, data };
  }
}
