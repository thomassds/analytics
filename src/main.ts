process.env.TZ = 'UTC';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { rabbitMQMicroservices } from './config/rabbitmq.config';

async function bootstrap() {
  // rawBody: preserva o corpo cru p/ validar a assinatura do webhook da Stripe
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https:\/\/.*\.up\.railway\.app$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
    credentials: true,
  });

  // RabbitMQ microservices
  rabbitMQMicroservices.forEach((config) => app.connectMicroservice(config));

  await app.startAllMicroservices();

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Football Analytics API')
      .setDescription('Análise matemática de jogos de futebol')
      .setVersion('1.0')
      .addBearerAuth(undefined, 'bearer')
      .addSecurityRequirements('bearer')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Application running on port ${port}`);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }
}
bootstrap();
