import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from './department.controller';
import { DepartmentService } from './departments.service'; // 👈 เพิ่มบรรทัดนี้
import { DepartmentSchema } from './schemas/department.schema'; // เช็ค path schema ของคุณด้วย
import { User, UserSchema } from '../users/schemas/user.schema'; 
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Department', schema: DepartmentSchema },
      { name: 'User', schema: UserSchema }, // 👈 ต้องมีตัวนี้เพื่อหาข้อมูลคนทำ Log
    ]),
    AuditLogsModule, // 👈 Import module เก็บ log
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentsModule {}
