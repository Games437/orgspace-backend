// src/bookings/schemas/booking.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true }) // คำสั่งนี้จะสร้าง createdAt และ updatedAt ให้เราอัตโนมัติ (มีประโยชน์มากเวลาทำ Log)
export class Booking {
  // รหัสห้องประชุม (เดี๋ยวเราจะเอาไปเชื่อมกับ Room Schema)
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  // รหัสพนักงานที่ทำการจอง (ต้องรอเชื่อมกับงานของเพื่อนที่ทำระบบ User)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // หัวข้อการประชุม
  @Prop({ required: true })
  title: string;

  // เวลาเริ่มประชุม
  @Prop({ required: true })
  startTime: Date;

  // เวลาเลิกประชุม
  @Prop({ required: true })
  endTime: Date;

  // สถานะการจอง (รออนุมัติ, อนุมัติแล้ว, ยกเลิก)
  @Prop({ default: 'APPROVED', enum: ['PENDING', 'APPROVED', 'CANCELLED'] })
  status: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);