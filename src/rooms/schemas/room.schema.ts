// src/rooms/schemas/room.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, min: 1, index: true })
  capacity: number;

  @Prop({ type: [String], default: [] })
  facilities: string[];

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 15 })
  bufferTime: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
