// src/bookings/bookings.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(
    // เรียกใช้งาน Model ที่เราผูกไว้ใน Module เพื่อเอามาต่อกับ Database
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // ฟังก์ชันสร้างการจองใหม่ (เดี๋ยวเราค่อยมาเพิ่มระบบเช็คเวลาชนทีหลัง เอาให้บันทึกได้ก่อน)
  async create(createBookingDto: any) {
    const newBooking = new this.bookingModel(createBookingDto);
    return await newBooking.save(); // บันทึกลง Database
  }

  // ฟังก์ชันดึงข้อมูลการจองทั้งหมด
  async findAll() {
    return await this.bookingModel.find().exec();
  }
}