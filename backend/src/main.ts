import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import express from 'express';

const server = express();
let isInitialized = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();
  isInitialized = true;
}

// Local development support
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const localBootstrap = async () => {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.listen(3000);
    console.log(`Backend API is running on: http://localhost:3000`);
  };
  localBootstrap();
}

export default async (req: any, res: any) => {
  if (!isInitialized) {
    await bootstrap();
  }
  server(req, res);
};
