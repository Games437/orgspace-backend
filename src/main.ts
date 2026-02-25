// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  // open cors
  app.enableCors({
    //origin: 'http://localhost:3001', // frontend URL
    origin: 'http://192.168.10.102:3001',
    credentials: true,
  });

  app.use(cookieParser());

  // กำหนดคำนำหน้า (Prefix) ให้กับทุกๆ Route ในระบบเป็น /api เช่น /api/users, /api/auth เป็นต้น
  app.setGlobalPrefix('api');

  // use global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  //await app.listen(process.env.PORT ?? 4000);
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
