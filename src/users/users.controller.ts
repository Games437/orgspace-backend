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
} from '@nestjs/common';
import type { Response } from 'express';

// Services & Security
import { UsersService } from './users.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// DTOs
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ================= PROFILE & READ =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่ล็อกอินแล้วสามารถดูข้อมูลโปรไฟล์ของตัวเองได้
  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.usersService.findMe(req.user);
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN, HR, MANAGER สามารถดูรายชื่อผู้ใช้ทั้งหมดได้
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Get()
  findAll(@Req() req) {
    return this.usersService.findAll(req.user);
  }

  // ================= MANAGEMENT OPERATIONS (CUD) =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN และ HR สามารถสร้างผู้ใช้ใหม่ได้
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  @Post()
  createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.usersService.createUser(dto, req.user);
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN, HR สามารถแก้ไขข้อมูลผู้ใช้ได้
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  @Put(':id') 
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.updateUser(id, dto, req.user);
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN, HR สามารถลบผู้ใช้ได้
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  @Delete(':id')
  deleteUser(@Param('id') id: string, @Req() req) {
    return this.usersService.deleteUser(id, req.user);
  }

  // ================= REPORTS & EXPORT =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN และ HR สามารถดาวน์โหลดรายงานผู้ใช้ในรูปแบบ CSV ได้
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
