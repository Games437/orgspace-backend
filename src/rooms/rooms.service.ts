// src/rooms/rooms.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // 1. สร้างห้องใหม่
  async create(createRoomDto: CreateRoomDto) {
    const newRoom = new this.roomModel(createRoomDto);
    return await newRoom.save();
  }

  // 2. ดูห้องทั้งหมด
  async findAll() {
    return await this.roomModel.find({ isActive: true }).exec();
  }

  // 3. ค้นหาห้องที่ว่าง (Available Search)
  async findAvailableRooms(startTime: string, endTime: string) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('ช่วงเวลาไม่ถูกต้องครับ');
    }

    const busyBookings = await this.bookingModel.find({
      status: { $ne: 'CANCELLED' }, // ไม่นับรายการที่ยกเลิก
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }]
    }).select('roomId').exec();

    const busyRoomIds = busyBookings.map(b => b.roomId);
    return await this.roomModel.find({ _id: { $nin: busyRoomIds }, isActive: true }).exec();
  }

  // 4. ดูห้องเดียว
  async findOne(id: string) {
    const room = await this.roomModel.findById(id).exec();
    if (!room) throw new NotFoundException('ไม่พบห้องที่ระบุ');
    return room;
  }

  // 5. แก้ไขห้อง
  async update(id: string, updateData: any) {
    return await this.roomModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  // 6. ลบห้อง (Soft Delete)
  async remove(id: string) {
    return await this.roomModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}