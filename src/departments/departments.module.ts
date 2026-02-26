import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from './department.controller';
import { DepartmentService } from './departments.service';
import { DepartmentSchema } from './schemas/department.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Department', schema: DepartmentSchema },
      { name: 'User', schema: UserSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentsModule {}
