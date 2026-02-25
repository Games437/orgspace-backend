import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';
import { User, UserSchema } from '../users/schemas/user.schema'; 
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
      // 💡 แนะนำ: ใช้ User.name แทนการพิมพ์ 'User' แบบ string 
      // เพื่อความปลอดภัยในการอ้างอิงชื่อ Model
      { name: User.name, schema: UserSchema }, 
    ]),
    AuditLogsModule, // นำเข้าโมดูลบันทึก Log
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  // 💡 ส่งออกเพื่อให้โมดูลอื่น (เช่น Rooms) เรียกใช้ตรวจสอบสถานะการจองได้
  exports: [BookingsService], 
})
export class BookingsModule {}