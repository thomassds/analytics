import { applyDecorators, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

/**
 * Rota de administração da plataforma: exige usuário platform admin.
 */
export const PlatformAdmin = () => applyDecorators(UseGuards(PlatformAdminGuard));
