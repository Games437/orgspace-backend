import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common'; // 👈 เพิ่ม Put, Body, Param
import { UsersService } from './users.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto'; // 👈 อย่าลืม Import DTO
import { CreateUserDto } from './dto/create-user.dto';
import type { Response } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR) // 👈 ดักสิทธิ์หน้าประตู ให้เข้าได้แค่ ADMIN และ HR
  @Post()
  createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.usersService.createUser(dto, req.user);
  }

  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Get()
  findAll(@Req() req) {
    return this.usersService.findAll(req.user);
  }

  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.usersService.findMe(req.user);
  }

  // 🚀 เพิ่มฟังก์ชันนี้เข้าไปเพื่อให้รองรับ PUT /users/{id}
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Put(':id') // 👈 กำหนด Path parameter เป็น :id
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    // ส่ง id, ข้อมูลที่แก้ (dto), และข้อมูลผู้ทำรายการ (req.user) ไปที่ Service
    return this.usersService.updateUser(id, dto, req.user);
  }
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Delete(':id')
  deleteUser(@Param('id') id: string, @Req() req) {
    return this.usersService.deleteUser(id, req.user);
  }
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  @Get('export/report')
  async exportReport(@Req() req, @Res() res: Response) {
    const csv = await this.usersService.exportReport(req.user);

    res.header('Content-Type', 'text/csv');
    res.attachment(`users-report-${Date.now()}.csv`);
    return res.send(csv);
  }
}
