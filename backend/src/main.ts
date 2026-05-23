import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS dinâmico: aceita Vercel preview deploys (*.vercel.app) + localhost
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      // Requisições sem origin (curl, Postman, mobile, MetaMask)
      if (!origin) return callback(null, true);
      // CORS_ORIGIN=* permite qualquer origem
      if (corsOrigin === '*') return callback(null, true);
      // Localhost
      if (origin.startsWith('http://localhost:')) return callback(null, true);
      // Vercel preview + production deploys
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      // Origem fixa configurada (Render, Railway, domínio próprio)
      if (origin === corsOrigin) return callback(null, true);
      callback(null, true); // permite outras origens (MVP — auth real é MetaMask)
    },
  });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  await app.listen(process.env.PORT ?? 3005);
}
bootstrap();
