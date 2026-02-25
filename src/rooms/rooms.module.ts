import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { LogsModule } from '../logs/logs.module';

// 1. นำเข้า Booking กับ BookingSchema จากโฟลเดอร์ bookings (เช็ค path ให้ตรงด้วยนะครับ)
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema'; // <--- เพิ่มบรรทัดนี้

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema } // <--- 2. เพิ่ม Booking เข้าไปในอาร์เรย์นี้
    ]),
    LogsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}