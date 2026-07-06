import { z } from 'zod';

export const RequestCodeDtoSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email({ message: 'INVALID_EMAIL_FORMAT' }).optional(),
    phone: z.string().min(8).max(20).optional(),
    channel: z.enum(['email', 'phone']),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'email' && !data.userId && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'VALIDATION_ERROR',
        path: ['email'],
      });
    }

    if (data.channel === 'phone' && !data.userId && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'VALIDATION_ERROR',
        path: ['phone'],
      });
    }
  });

export type RequestCodeDto = z.infer<typeof RequestCodeDtoSchema>;
