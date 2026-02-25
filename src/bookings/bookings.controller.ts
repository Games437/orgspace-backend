// 1. เพิ่ม UseInterceptors เข้าไปในวงเล็บนี้ครับ
import { Controller, Get, Post, Body, Patch, Param, Query, UseInterceptors } from '@nestjs/common'; 
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto'; 
// 2. นำเข้าไฟล์ Interceptor ที่เราเขียนไว้ (เช็ค path ให้ตรงกับโฟลเดอร์คุณนะครับ)
import { LoggingInterceptor } from '../logs/logging.interceptor'; 

@Controller('bookings')
@UseInterceptors(LoggingInterceptor) // <--- 3. แปะยันต์เปิดกล้องวงจรปิดคุมทั้ง Controller ตรงนี้เลย!
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Body() createBookingDto: CreateBookingDto) { 
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  async findAll(
    @Query('roomId') roomId?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingsService.findAll(roomId, date);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }
}