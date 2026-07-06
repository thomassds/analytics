import { z } from 'zod';

export const LoginDtoSchema = z.object({
  email: z.string().email({ message: 'INVALID_EMAIL_FORMAT' }),
  password: z.string().min(1, { message: 'VALIDATION_ERROR' }),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;
