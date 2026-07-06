import { z } from 'zod';

export const RecoveryPasswordDtoSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['email', 'phone']),
  code: z.string().length(6),
  password: z
    .string()
    .min(8, { message: 'WEAK_PASSWORD' })
    .regex(/[A-Z]/, { message: 'WEAK_PASSWORD' })
    .regex(/[0-9]/, { message: 'WEAK_PASSWORD' }),
});

export type RecoveryPasswordDto = z.infer<typeof RecoveryPasswordDtoSchema>;
