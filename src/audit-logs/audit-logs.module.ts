import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { AuditLogsService } from './audit-logs.service';

@Global() // 👈 ใส่ Global เพื่อให้ทุก Module ในโปรเจกต์เรียกใช้ได้ทันที
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  providers: [AuditLogsService],
  exports: [AuditLogsService], // 👈 ต้องส่งออก Service ไปให้คนอื่นใช้
})
export class AuditLogsModule {}