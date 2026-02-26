import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  // ฟังก์ชันสำหรับบันทึก Log ใหม่
  async log(data: any) {
    const newLog = new this.auditLogModel(data);
    return newLog.save();
  }

  // ฟังก์ชันสำหรับดึง Log ทั้งหมด (เรียงจากใหม่สุดไปเก่าสุด)
  async findAll() {
    // ดึง Log ทั้งหมด และเรียงจากใหม่สุดไปเก่าสุด
    return this.auditLogModel.find().sort({ createdAt: -1 }).exec();
  }

  // ฟังก์ชันสำหรับดึง Log ทั้งหมด พร้อมข้อมูลผู้ใช้ที่เกี่ยวข้อง
  async getLogs() {
    const logs = await this.auditLogModel
      .find()
      .populate('actorId', 'full_name role userId')
      .sort({ createdAt: -1 })
      .exec();

    return logs.map((log) => {
      const logObj = log.toObject();

      return {
        ...logObj,
        actorName: (logObj.actorId as any)?.full_name || 'ไม่พบข้อมูลผู้ใช้',
        actorRole: (logObj.actorId as any)?.role || 'N/A',
        createdAtThai: (log as any).createdAt?.toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok',
        }),
      };
    });
  }
}
