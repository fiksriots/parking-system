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

// If not running on Vercel, boot NestJS as a standard persistent server (cPanel/VPS/Local)
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  const startServer = async () => {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.listen(port);
    console.log(`Backend API is running on port: ${port}`);
  };
  startServer();
}

export default async (req: any, res: any) => {
  if (!isInitialized) {
    await bootstrap();
  }
  server(req, res);
};
