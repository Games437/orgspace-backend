import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; //
import { User, UserSchema } from '../users/schemas/user.schema'; //

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService], //
})
export class RoomsModule {}