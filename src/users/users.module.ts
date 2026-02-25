import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import {
  Department,
  DepartmentSchema,
} from '../departments/schemas/department.schema'; // 👈 นำเข้า Schema
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: 'Department', schema: DepartmentSchema }, // 👈 เพิ่มบรรทัดนี้เพื่อให้ InjectModel('Department') ทำงานได้
    ]),
    AuditLogsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
