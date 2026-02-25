import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel('User') private userModel: Model<any>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 1. สร้างห้องใหม่
  async create(createRoomDto: CreateRoomDto, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่จัดการห้องได้');
    }

    const newRoom = await this.roomModel.create(createRoomDto);

    await this.logAction(
      currentUser,
      AuditAction.CREATE_ROOM,
      String(newRoom._id),
      `สร้างห้องประชุมใหม่: ${newRoom.name}`,
      null,
      createRoomDto,
    );

    return newRoom;
  }

  // 2. ดูห้องเดี่ยว
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('รหัสห้องไม่ถูกต้อง');
    const room = await this.roomModel.findById(id).exec();
    if (!room) throw new NotFoundException('ไม่พบห้องที่ระบุ');
    return room;
  }

  // 3. ดูห้องทั้งหมด
  async findAll() {
    return await this.roomModel.find({ isActive: true }).exec();
  }

  // 4. ค้นหาห้องที่ว่าง (หัวใจของระบบจอง)
  async findAvailableRooms(startTime: string, endTime: string) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('ช่วงเวลาไม่ถูกต้องครับ');
    }

    // 
    const busyBookings = await this.bookingModel
      .find({
        status: { $ne: 'CANCELLED' },
        $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
      })
      .select('roomId')
      .exec();

    const busyRoomIds = busyBookings.map((b) => b.roomId);
    
    return await this.roomModel
      .find({ _id: { $nin: busyRoomIds }, isActive: true })
      .exec();
  }

  // 5. แก้ไขห้อง
  async update(id: string, updateData: any, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่แก้ไขห้องได้');
    }

    const oldRoom = await this.roomModel.findById(id).lean();
    if (!oldRoom) throw new NotFoundException('ไม่พบห้องที่ระบุ');

    const updatedRoom = await this.roomModel
      .findByIdAndUpdate(
        id,
        { $set: updateData }, // ใช้ $set เพื่อความปลอดภัย
        { returnDocument: 'after' },
      )
      .exec();

    await this.logAction(
      currentUser,
      AuditAction.UPDATE_ROOM,
      id,
      `แก้ไขข้อมูลห้อง: ${oldRoom.name}`,
      oldRoom,
      updateData,
    );

    return updatedRoom;
  }

  // 6. ลบห้อง (Hard Delete พร้อม Security Check)
  async remove(id: string, currentUser: any) {
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะ ADMIN เท่านั้นที่ลบห้องได้');
    }

    const room = await this.roomModel.findById(id);
    if (!room) throw new NotFoundException('ไม่พบห้องที่ต้องการลบ');

    // 🛡️ ห้ามลบถ้ามีคิวจองในอนาคต
    const futureBooking = await this.bookingModel
      .findOne({
        roomId: id,
        startTime: { $gt: new Date() },
        status: { $ne: 'CANCELLED' },
      })
      .exec();

    if (futureBooking) {
      throw new BadRequestException(
        'ไม่สามารถลบได้เนื่องจากมีการจองค้างอยู่ในอนาคต',
      );
    }

    await this.roomModel.findByIdAndDelete(id).exec();

    await this.logAction(
      currentUser,
      AuditAction.DELETE_ROOM,
      id,
      `ลบห้องประชุม: ${room.name}`,
      room,
      null,
    );

    return { message: 'ลบห้องออกจากระบบสำเร็จ' };
  }

  // 7. ฟังก์ชันช่วยบันทึก Log
  private async logAction(
    currentUser: any,
    action: AuditAction,
    targetId: string,
    details: string,
    oldValue: any,
    newValue: any,
  ) {
    const actorId = currentUser.id || currentUser.sub;
    
    // ✅ กำหนด Type: any เพื่อป้องกัน TS Error 'never'
    let actor: any = null;
    if (Types.ObjectId.isValid(actorId)) {
      actor = await this.userModel.findById(actorId).exec();
    }

    await this.auditLogsService.log({
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'System',
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