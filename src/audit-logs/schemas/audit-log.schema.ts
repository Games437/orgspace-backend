import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose'; // 👈 เพิ่ม Schema as MongooseSchema ตรงนี้
import { AuditAction } from 'src/common/enums/audit-action.enum';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  // ตอนนี้ MongooseSchema จะใช้งานได้แล้วครับ
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId: MongooseSchema.Types.ObjectId;

  @Prop({ type: Object }) // เก็บเป็น Object เล็กๆ เพื่อให้อ่านง่าย
  actorInfo: {
    full_name: string;
    role: string;
    userId: string;
  };

  @Prop({ required: true, enum: AuditAction })
  action: string;

  @Prop({ type: String }) // เพิ่มรายละเอียดเหตุการณ์
  details: string;

  @Prop({ type: String, required: true })
  targetId: string;

  @Prop({ type: Object })
  oldValue: any;

  @Prop({ type: Object })
  newValue: any;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
