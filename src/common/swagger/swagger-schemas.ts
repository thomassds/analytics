export const errorSchema = (codeExample: string, messageExample: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: codeExample },
        message: { type: 'string', example: messageExample },
      },
    },
  },
});

export const successSchema = (dataProperties: Record<string, any>) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: dataProperties,
    },
  },
});
