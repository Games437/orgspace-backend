import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';

// Services & Security
import { DepartmentService } from './departments.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// DTOs
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(AccessTokenGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentService: DepartmentService) {}

  // ================= READ OPERATIONS (การดึงข้อมูล) =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN, HR สามารถดูรายชื่อแผนกทั้งหมดได้
  @Get()
  @Roles(Role.ADMIN, Role.HR)
  async findAll(@Req() req: any) {
    return this.departmentService.findAll(req.user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR)
  async findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  // ================= WRITE OPERATIONS (การจัดการข้อมูล) =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN สามารถสร้างแผนกใหม่ได้
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateDepartmentDto, // 👈 ใช้ DTO แทนการเขียนไทป์สดๆ
    @Req() req: any,
  ) {
    return this.departmentService.create(dto, req.user);
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN สามารถแก้ไขข้อมูลแผนกได้
  @Put(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto, // 👈 รับเป็น DTO เพื่อให้แก้ description ได้ด้วย
    @Req() req: any,
  ) {
    return this.departmentService.update(id, dto, req.user);
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่มีสิทธิ์ ADMIN สามารถลบแผนกได้
  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.departmentService.delete(id, req.user);
  }
}
