// src/bookings/schemas/booking.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  // 🏢 เชื่อมกับ Room (เพิ่ม index เพื่อให้เช็คห้องว่างได้เร็วขึ้น)
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  // 👤 เชื่อมกับ User (เพิ่ม index เพื่อให้ดึงประวัติการจองของคนคนนั้นได้ไว)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string; // 👈 อย่าลืมเพิ่มฟิลด์หัวข้อการประชุมด้วยนะครับ (ใน Service มีการเรียกใช้ savedBooking.title)

  // ⏰ เวลาเริ่ม (เพิ่ม index เพื่อใช้เปรียบเทียบช่วงเวลา)
  @Prop({ required: true, index: true })
  startTime: Date;

  // ⏰ เวลาเลิก
  @Prop({ required: true, index: true })
  endTime: Date;

  // 🚦 สถานะ (APPROVED เป็นค่าเริ่มต้นตามที่คุณต้องการ)
  @Prop({
    default: 'APPROVED',
    enum: ['PENDING', 'APPROVED', 'CANCELLED', 'COMPLETED'],
    index: true,
  })
  status: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// 💡 เทคนิคพิเศษ: ทำ Compound Index เพื่อกันจองซ้ำซ้อนในระดับ Database (ถ้าต้องการความชัวร์ 100%)
// BookingSchema.index({ roomId: 1, startTime: 1, endTime: 1 });
