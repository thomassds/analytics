import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ValidationCode } from './entities/validation-code.entity';
import { UserRepository } from './repositories/user.repository';
import { ValidationCodeRepository } from './repositories/validation-code.repository';
import { MessagingModule } from '../messaging/messaging.module';
import { OnboardingUseCase } from './use-cases/onboarding.use-case';
import { RequestCodeUseCase } from './use-cases/request-code.use-case';
import { ValidateCodeUseCase } from './use-cases/validate-code.use-case';
import { SavePersonalDataUseCase } from './use-cases/save-personal-data.use-case';
import { RecoveryPasswordUseCase } from './use-cases/recovery-password.use-case';
import { AuthController } from './auth.controller';
import { LoginUseCase } from './use-cases/login.use-case';
import { JwtModule } from '@nestjs/jwt';
import { USER_LOADER_TOKEN } from '../../common/contracts/user-loader-by-id.contract';
import { FindUserByIdService } from './services/find-user-by-id.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ValidationCode]),
    MessagingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  exports: [JwtModule, USER_LOADER_TOKEN],
  providers: [
    UserRepository,
    ValidationCodeRepository,
    OnboardingUseCase,
    RequestCodeUseCase,
    ValidateCodeUseCase,
    SavePersonalDataUseCase,
    RecoveryPasswordUseCase,
    LoginUseCase,
    FindUserByIdService,
    {
      provide: USER_LOADER_TOKEN,
      useClass: FindUserByIdService,
    },
  ],
})
export class AuthModule {}
