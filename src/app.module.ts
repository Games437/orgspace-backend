// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

// Internal Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    // Core & Configuration
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ตั้งค่า rate limiting โดยใช้ ThrottlerModule 100 requests ต่อนาที (60_000 ms = 1 นาที)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // Database Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    // Business Modules
    UsersModule,
    AuthModule,
    DepartmentsModule,
    AuditLogsModule,
    RoomsModule,
    BookingsModule,
  ],

  // *** สำหรับการตั้งค่า global guard กรณีกันโดนยิง API รัว ๆ ทั้งระบบ ThrottlerGuard ***
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
