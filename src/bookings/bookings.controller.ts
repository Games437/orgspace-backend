import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { Request } from 'express'; // 👈 นำเข้า Request จาก express เพื่อความแม่นยำ

@Controller('bookings')
@UseGuards(AccessTokenGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // 1. จองห้องประชุม
  @Post()
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: any, // req.user จะถูกแนบมาโดย AccessTokenGuard
  ) {
    return this.bookingsService.create(createBookingDto, req.user);
  }

  // 2. ดูประวัติการจอง (กรองตาม roomId หรือ date ได้)
  @Get()
  async findAll(
    @Query('roomId') roomId?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingsService.findAll(roomId, date);
  }

  // 3. ยกเลิกการจอง
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any) {
    // Logic ใน Service จะเช็คความเป็นเจ้าของให้เอง
    return this.bookingsService.cancelBooking(id, req.user);
  }
}
