// src/bookings/schemas/booking.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, index: true })
  startTime: Date;

  @Prop({ required: true, index: true })
  endTime: Date;

  @Prop({
    default: 'APPROVED',
    enum: ['PENDING', 'APPROVED', 'CANCELLED', 'COMPLETED'],
    index: true,
  })
  status: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

