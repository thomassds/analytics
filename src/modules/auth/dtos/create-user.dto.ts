import { z } from 'zod';

export const CreateUserDtoSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email({ message: 'INVALID_EMAIL_FORMAT' }),
  password: z
    .string()
    .min(8, { message: 'WEAK_PASSWORD' })
    .regex(/[A-Z]/, { message: 'WEAK_PASSWORD' })
    .regex(/[0-9]/, { message: 'WEAK_PASSWORD' }),
});

export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;
