import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel('User') private userModel: Model<any>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleAutoArchive() {
    const now = new Date();

    console.log(`[Cron Job] Checking for expired bookings at ${now.toISOString()}`);

    // ค้นหาการจองที่:
    // 1. สถานะยังเป็น APPROVED
    // 2. เวลา endTime ผ่านมาแล้ว (น้อยกว่าเวลาปัจจุบัน)
    const result = await this.bookingModel.updateMany(
      {
        status: 'APPROVED',
        endTime: { $lt: now },
      },
      {
        $set: { status: 'COMPLETED' },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cron Job] Successfully archived ${result.modifiedCount} bookings.`);
    }
  }

  // 1. สร้างการจอง (รองรับ roomName)
  async create(createBookingDto: CreateBookingDto, currentUser: any) {
    const { roomName, startTime, endTime, title } = createBookingDto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 🛡️ เช็คความถูกต้องของเวลา
    if (start >= end) {
      throw new BadRequestException('เวลาเริ่มจองต้องอยู่ก่อนเวลาสิ้นสุด');
    }
    if (start < new Date()) {
      throw new BadRequestException('ไม่สามารถจองห้องย้อนหลังได้');
    }

    // 🔍 1. ค้นหาห้องจาก "ชื่อห้อง" (ใช้ RegExp เพื่อให้ไม่ซีเรียสเรื่องตัวพิมพ์เล็ก/ใหญ่)
    const room = await this.roomModel.findOne({
      name: { $regex: new RegExp(`^${roomName}$`, 'i') },
      isActive: true,
    });

    if (!room) {
      throw new NotFoundException(`ไม่พบห้องชื่อ "${roomName}" หรือห้องถูกปิดใช้งานแล้ว`);
    }
    const bufferMs = (room.bufferTime || 0) * 60 * 1000;

    // 🛡️ 2. Overlap Check: ป้องกันจองซ้ำ (ใช้ room._id ที่หาเจอ)
    const overlappingBooking = await this.bookingModel.findOne({
      roomId: room._id,
      status: { $ne: 'CANCELLED' },
      $or: [
        {
          startTime: { $lt: new Date(end.getTime() + bufferMs) },
          endTime: { $gt: new Date(start.getTime() - bufferMs) },
        },
      ],
    });

    if (overlappingBooking) {
      // คำนวณเวลาที่ห้องจะว่างจริงๆ เพื่อแจ้ง User
      const actualAvailableTime = new Date(overlappingBooking.endTime.getTime() + bufferMs);
      throw new BadRequestException(
        `ห้อง ${roomName} ไม่ว่างในช่วงเวลานี้ เนื่องจากต้องเว้นระยะพักห้อง ${room.bufferTime} นาที (ห้องจะว่างเวลา ${actualAvailableTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.)`,
      );
    }

    // 💾 3. บันทึกข้อมูล (เปลี่ยนจาก roomName เป็น roomId เพื่อเก็บลง DB)
    const newBooking = new this.bookingModel({
      ...createBookingDto,
      roomId: room._id, // บันทึกเป็น ID ตาม Schema
      userId: currentUser.id || currentUser.sub,
      status: 'APPROVED',
    });

    let savedBooking = await newBooking.save();
    
    // Populate ข้อมูลก่อนส่งกลับ
    savedBooking = await savedBooking.populate([
      { path: 'roomId', select: 'name' },
      { path: 'userId', select: 'full_name' },
    ]);

    // 🚀 4. บันทึก Audit Log
    await this.logAction(
      currentUser,
      AuditAction.CREATE_BOOKING,
      String(savedBooking._id),
      `จองห้องประชุม: ${room.name} (${title}) [Buffer: ${room.bufferTime}m]`,
      null,
      createBookingDto,
    );

    return savedBooking;
  }

  // 2. ค้นหาประวัติการจอง
  async findAll(roomId?: string, date?: string) {
    const filter: any = {};
    if (roomId && Types.ObjectId.isValid(roomId)) {
      filter.roomId = new Types.ObjectId(roomId);
    }
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: startOfDay, $lte: endOfDay };
    }

    return await this.bookingModel
      .find(filter)
      .populate('roomId', 'name')
      .populate('userId', 'full_name')
      .sort({ startTime: 1 })
      .exec();
  }

  // 3. ยกเลิกการจอง
  async cancelBooking(id: string, currentUser: any) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('รหัสการจองไม่ถูกต้อง');
    
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('ไม่พบรายการจอง');

    const actorId = currentUser.id || currentUser.sub;
    if (currentUser.role !== 'ADMIN' && booking.userId.toString() !== actorId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ยกเลิกการจองของผู้อื่น');
    }

    const result = await this.bookingModel
      .findByIdAndUpdate(
        id,
        { status: 'CANCELLED' },
        { returnDocument: 'after' },
      )
      .populate('roomId', 'name');

    await this.logAction(
      currentUser,
      AuditAction.CANCEL_BOOKING,
      id,
      `ยกเลิกการจอง: ${booking.title}`,
      { status: booking.status },
      { status: 'CANCELLED' },
    );

    return result;
  }

  // 4. ฟังก์ชันช่วยบันทึก Audit Log
  private async logAction(
    currentUser: any,
    action: AuditAction,
    targetId: string,
    details: string,
    oldValue: any,
    newValue: any,
  ) {
    const actorId = currentUser.id || currentUser.sub;
    let actor: any = null;

    if (Types.ObjectId.isValid(actorId)) {
      actor = await this.userModel.findById(actorId).exec();
    }

    await this.auditLogsService.log({
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'System User',
        role: currentUser.role,
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action,
      targetId,
      details,
      oldValue,
      newValue,
    });
  }
}