import { z } from 'zod';

export const PersonalDataDtoSchema = z.object({
  userId: z.string().uuid(),
  taxIdentifier: z.string().min(11).max(18),
  phone: z.string().min(10).max(20),
  countryCode: z.string().min(2).max(10),
  zipCode: z.string().min(8).max(20),
  street: z.string().min(2).max(255),
  neighborhood: z.string().min(2).max(255),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  number: z.string().min(1).max(20),
  complement: z.string().max(255).optional(),
});

export type PersonalDataDto = z.infer<typeof PersonalDataDtoSchema>;
