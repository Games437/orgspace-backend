// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ตั้งค่า rate limiting โดยใช้ ThrottlerModule
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    UsersModule,
    AuthModule,
    DepartmentsModule,
    AuditLogsModule,
  ],
  // controllers: [AppController],  ตัดออกไม่ได้ใช้

  // *** สำหรับการตั้งค่า global guard กรณีกันโดนยิง API รัว ๆ ทั้งระบบ ThrottlerGuard ***
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    //Global RolesGuard สำหรับการตรวจสอบสิทธิ์การเข้าถึง API ทั้งระบบ (ถ้ามีการใช้ @Roles() ใน controller)
    //{ provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
