import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true })
  name: string; // ชื่อห้อง เช่น "Meeting Room A"

  @Prop({ required: true })
  capacity: number; // ความจุคน

  @Prop({ type: [String], default: [] })
  facilities: string[]; // สิ่งอำนวยความสะดวก

  @Prop({ default: true })
  isActive: boolean; // สถานะห้องว่าพร้อมใช้งานหรือไม่
}

export const RoomSchema = SchemaFactory.createForClass(Room);