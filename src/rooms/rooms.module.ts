import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // 👈 ใช้ Relative Path เพื่อความสม่ำเสมอ
import { User, UserSchema } from '../users/schemas/user.schema'; // 👈 นำเข้า Class User มาด้วย

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema },
      // 💡 แนะนำ: ใช้ User.name แทน 'User' เพื่อให้ตรงกับ @InjectModel(User.name) ใน Service
      { name: User.name, schema: UserSchema }, 
    ]),
    AuditLogsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService], // 💡 เผื่อโมดูลอื่น (เช่น Bookings) ต้องการเรียกใช้ findOne หรือ findAll
})
export class RoomsModule {}