import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
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

  // ดูห้องว่างตามช่วงเวลา
  @Get('available')
  async findAvailable(
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.roomsService.findAvailableRooms(startTime, endTime);
  }

  // สร้างห้องใหม่ (ADMIN Only)
  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() createRoomDto: CreateRoomDto, @Req() req: any) {
    return this.roomsService.create(createRoomDto, req.user);
  }

  // ดูห้องทั้งหมด
  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  // ดูรายละเอียดห้องเดียว
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  // แก้ไขข้อมูลห้อง (ADMIN Only)
  @Patch(':id') // 👈 ใช้ Patch แทน Put สำหรับ Partial Update
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: any,
  ) {
    return this.roomsService.update(id, updateData, req.user);
  }

  // ลบห้อง (ADMIN Only)
  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.roomsService.remove(id, req.user);
  }
}
