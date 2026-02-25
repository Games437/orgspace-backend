// src/rooms/schemas/room.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, trim: true, index: true }) // trim เพื่อตัดช่องว่างหัว-ท้าย และ index เพื่อให้ค้นหาด้วยชื่อไวขึ้น
  name: string;

  @Prop({ required: true, min: 1, index: true }) // index เพื่อให้ Filter ตามขนาดความจุได้เร็ว
  capacity: number;

  @Prop({ type: [String], default: [] })
  facilities: string[];

  @Prop({ default: true, index: true }) // index เพื่อให้ดึงเฉพาะห้องที่พร้อมใช้งาน (isActive: true) ได้ไว
  isActive: boolean;

  @Prop({ default: 15 })
  bufferTime: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);