import { z } from 'zod';

export const ValidateCodeDtoSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['email', 'phone']),
  code: z.string().length(6),
  justCheck: z.boolean().optional(),
});

export type ValidateCodeDto = z.infer<typeof ValidateCodeDtoSchema>;
