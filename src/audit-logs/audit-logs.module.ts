import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { AuditLogsService } from './audit-logs.service';

@Global() // 👈 ใส่ Global เพื่อให้ทุก Module ในโปรเจกต์เรียกใช้ได้ทันที
@Module({
  imports: [MongooseModule.forFeature([{ name: 'AuditLog', schema: AuditLogSchema }])],
  controllers: [AuditLogsController], // 👈 เพิ่มบรรทัดนี้
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}