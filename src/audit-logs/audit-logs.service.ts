import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) { }

  async log(data: any) {
    const newLog = new this.auditLogModel(data);
    return newLog.save();
  }

  async findAll() { 
    // ดึง Log ทั้งหมด และเรียงจากใหม่สุดไปเก่าสุด
    return this.auditLogModel.find().sort({ createdAt: -1 }).exec();
  }

  async getLogs() {
    // 1. เพิ่ม .populate ตรงนี้เพื่อดึงข้อมูลจากตาราง User มาใส่ใน actorId
    const logs = await this.auditLogModel
      .find()
      .populate('actorId', 'full_name role userId') // 👈 ดึงชื่อ, บทบาท และรหัสพนักงาน
      .sort({ createdAt: -1 })
      .exec();

    return logs.map((log) => {
      const logObj = log.toObject();

      return {
        ...logObj,
        // เพิ่มฟิลด์ให้อ่านง่ายขึ้นสำหรับคนดู
        actorName: (logObj.actorId as any)?.full_name || 'ไม่พบข้อมูลผู้ใช้',
        actorRole: (logObj.actorId as any)?.role || 'N/A',
        createdAtThai: (log as any).createdAt?.toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok',
        }),
      };
    });
  }
}