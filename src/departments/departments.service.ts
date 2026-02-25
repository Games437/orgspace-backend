import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose'; // 👈 เพิ่ม Types
import { Role } from '../common/enums/role.enum';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service'; // 👈 นำเข้า Service เก็บ Log
import { AuditAction } from '../common/enums/audit-action.enum'; // 👈 นำเข้า Enum Action

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel('Department')
    private departmentModel: Model<any>,
    @InjectModel('User') // 👈 ฉีด UserModel เข้ามาเพื่อดึงชื่อคนทำ Log
    private userModel: Model<any>,
    private readonly auditLogsService: AuditLogsService, // 👈 ฉีด AuditLogsService
  ) {}

  // ================= 1. ค้นหาแผนกทั้งหมด =================
  async findAll(currentUser: any) {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.HR) {
      return this.departmentModel.find().exec();
    }
    if (currentUser.department) {
      return this.departmentModel.find({ _id: currentUser.department }).exec();
    }
    return [];
  }

  // ================= 2. ค้นหาแผนกเดียว =================
  async findOne(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID ไม่ถูกต้อง');
    const dept = await this.departmentModel.findById(id).exec();
    if (!dept) throw new NotFoundException('ไม่พบแผนกนี้');
    return dept;
  }

  // ================= 3. สร้างแผนก + Audit Log =================
  async create(dto: CreateDepartmentDto, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่สร้างแผนกได้');
    }

    const newDept = await this.departmentModel.create(dto);

    // 🚀 บันทึก Log
    await this.saveAuditLog(
      currentUser,
      AuditAction.CREATE_DEPARTMENT,
      String(newDept._id),
      `สร้างแผนกใหม่: ${newDept.name}`,
      null,
      dto,
    );

    return newDept;
  }

  // ================= 4. แก้ไขแผนก + Audit Log =================
  async update(id: string, dto: UpdateDepartmentDto, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่แก้ไขแผนกได้');
    }

    if (!isValidObjectId(id)) throw new BadRequestException('ID ไม่ถูกต้อง');

    const oldDept = await this.departmentModel.findById(id).lean();
    if (!oldDept) throw new NotFoundException('ไม่พบแผนกที่ต้องการแก้ไข');

    const updatedDept = await this.departmentModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .exec();

    // 🚀 บันทึก Log
    await this.saveAuditLog(
      currentUser,
      AuditAction.UPDATE_DEPARTMENT,
      id,
      `แก้ไขแผนก: ${oldDept.name}`,
      oldDept,
      dto,
    );

    return updatedDept;
  }

  // ================= 5. ลบแผนก + Audit Log =================
  async delete(id: string, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่ลบแผนกได้');
    }

    if (!isValidObjectId(id)) throw new BadRequestException('ID ไม่ถูกต้อง');

    const targetDept = await this.departmentModel.findById(id).lean();
    if (!targetDept) throw new NotFoundException('ไม่พบแผนกที่ต้องการลบ');

    await this.departmentModel.findByIdAndDelete(id).exec();

    // 🚀 บันทึก Log
    await this.saveAuditLog(
      currentUser,
      AuditAction.DELETE_DEPARTMENT,
      id,
      `ลบแผนก: ${targetDept.name}`,
      targetDept,
      null,
    );

    return { message: 'ลบแผนกสำเร็จ' };
  }

  // 🛠️ ฟังก์ชันช่วยบันทึก Audit Log (Reusable)
  private async saveAuditLog(
    currentUser: any,
    action: AuditAction,
    targetId: string,
    details: string,
    oldValue: any,
    newValue: any,
  ) {
    const actorId = currentUser.id || currentUser.sub;
    const actor = await this.userModel.findById(actorId).exec();

    await this.auditLogsService.log({
      actorId: new Types.ObjectId(actorId),
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'System',
        role: currentUser.role,
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action: action,
      targetId: targetId,
      details: details,
      oldValue: oldValue,
      newValue: newValue,
    });
  }
}
