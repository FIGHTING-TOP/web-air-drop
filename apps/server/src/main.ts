import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { join } from 'path';
import { AppModule } from './app.module';
import { resolveWebDist, webDistExists } from './spa/web-dist';

const MAX_FILE_BYTES = Number(process.env.FILE_MAX_BYTES ?? 100 * 1024 * 1024);

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      // Must cover multipart total size; default Fastify bodyLimit is only 1MB.
      bodyLimit: MAX_FILE_BYTES,
    }),
  );

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_BYTES,
      files: 20,
    },
  });

  const origin = process.env.CORS_ORIGIN ?? true;
  app.enableCors({
    origin:
      typeof origin === 'string'
        ? origin.split(',').map((s) => s.trim())
        : origin,
    credentials: true,
  });

  const webDist = resolveWebDist();
  if (webDistExists()) {
    // Vite emits hashed files under /assets — avoid clashing with SPA routes on /
    await app.register(fastifyStatic, {
      root: join(webDist, 'assets'),
      prefix: '/assets/',
      decorateReply: false,
    });
    console.log(`Serving web SPA from ${webDist}`);
  } else {
    console.warn(`Web dist not found at ${webDist} (API-only mode)`);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Airdrop server listening on http://localhost:${port}`);
}

bootstrap();
