// 1. เพิ่ม UseInterceptors ตรงนี้
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors } from '@nestjs/common'; 
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
// 2. นำเข้าไฟล์ Interceptor ของเรา (เช็ค path ให้ตรงด้วยนะครับ)
import { LoggingInterceptor } from '../logs/logging.interceptor'; 

@Controller('rooms')
@UseInterceptors(LoggingInterceptor) // <--- 3. แปะยันต์เปิดกล้องวงจรปิดคุมตึก Rooms!
// บรรทัดนี้คือจุดที่ผิดครับ ต้องใส่ export ไว้ข้างหน้า class เสมอ
export class RoomsController { 
  constructor(private readonly roomsService: RoomsService) {}

  // 1. ค้นหาห้องว่าง (วางไว้ก่อน :id)
  @Get('available/search')
  async findAvailable(
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.roomsService.findAvailableRooms(startTime, endTime);
  }

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Get()
  async findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.roomsService.update(id, updateData);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}