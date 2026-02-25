import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'; // เพิ่ม BadRequestException
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema'; 
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>, 
  ) {}

  // 1. ฟังก์ชันสร้างการจอง พร้อมระบบเช็คห้องทิพย์และเช็คจองซ้ำ
  async create(createBookingDto: CreateBookingDto) {
    // ก. ตรวจสอบว่ามีห้องนี้อยู่จริงในฐานข้อมูลไหม
    const room = await this.roomModel.findById(createBookingDto.roomId);
    if (!room) {
      throw new NotFoundException(`ไม่พบห้องรหัส ${createBookingDto.roomId} ในระบบครับ`);
    }

    // ข. ตรวจสอบการจองทับซ้อน (Overlap Check) 🛡️
    const overlappingBooking = await this.bookingModel.findOne({
      roomId: createBookingDto.roomId,
      status: 'APPROVED', // เช็คเฉพาะรายการที่ยังไม่ถูกยกเลิก
      $or: [
        {
          startTime: { $lt: new Date(createBookingDto.endTime) },
          endTime: { $gt: new Date(createBookingDto.startTime) },
        },
      ],
    });

    if (overlappingBooking) {
      throw new BadRequestException(
        `ไม่สามารถจองได้ เนื่องจากเวลานี้มีการจองอยู่แล้ว (${overlappingBooking.title})`
      );
    }

    // ค. บันทึกการจองเมื่อผ่านเงื่อนไขทั้งหมด
    const newBooking = new this.bookingModel(createBookingDto);
    return await newBooking.save();
  }

  // 2. ฟังก์ชันค้นหาประวัติการจอง (รองรับ GET /bookings)
  async findAll(roomId?: string, date?: string) {
    const filter: any = {};
    if (roomId) filter.roomId = roomId;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.startTime = { $gte: start, $lt: end };
    }
    return await this.bookingModel.find(filter).exec();
  }

  // 3. ฟังก์ชันยกเลิกการจอง (รองรับ PATCH /bookings/:id/cancel)
  async cancelBooking(id: string) {
    const result = await this.bookingModel.findByIdAndUpdate(
      id,
      { status: 'CANCELLED' },
      { new: true }
    );
    if (!result) {
      throw new NotFoundException(`ไม่พบรหัสการจอง ID: ${id} ครับ`);
    }
    return result;
  }
}