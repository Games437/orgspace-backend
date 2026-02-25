import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { LogsModule } from '../logs/logs.module';

// 1. นำเข้า Room กับ RoomSchema (เช็ค path ให้ตรงกับโฟลเดอร์ rooms ของคุณนะครับ)
import { Room, RoomSchema } from '../rooms/schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema } // <--- 2. จดทะเบียน RoomModel ให้ตึก Bookings รู้จัก
    ]),
    LogsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}