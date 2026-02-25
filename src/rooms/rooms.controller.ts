import {
  Controller,
  Get,
  Post,
  Body,
  Patch, // 👈 เปลี่ยนจาก Put เป็น Patch
  Param,
  Delete,
  UseGuards,
  Req,
  Query, // 👈 เพิ่ม Query สำหรับค้นหาห้องว่าง
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('rooms')
@UseGuards(AccessTokenGuard, RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // 1. ค้นหาห้องที่ว่าง (ต้องวางไว้ก่อน :id ไม่งั้นจะโดนตีเป็น id = 'available')
  @Get('available')
  async findAvailable(
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.roomsService.findAvailableRooms(startTime, endTime);
  }

  // 2. สร้างห้องใหม่ (ADMIN Only)
  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() createRoomDto: CreateRoomDto, @Req() req: any) {
    return this.roomsService.create(createRoomDto, req.user);
  }

  // 3. ดูห้องทั้งหมด
  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  // 4. ดูรายละเอียดห้องเดียว
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  // 5. แก้ไขข้อมูลห้อง (ADMIN Only)
  @Patch(':id') // 👈 ใช้ Patch แทน Put สำหรับ Partial Update
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: any,
  ) {
    return this.roomsService.update(id, updateData, req.user);
  }

  // 6. ลบห้อง (ADMIN Only)
  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.roomsService.remove(id, req.user);
  }
}