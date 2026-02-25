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
import { DepartmentService } from './departments.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
// 1. นำเข้า DTO ที่เราสร้างไว้
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(AccessTokenGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(Role.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateDepartmentDto, // 👈 ใช้ DTO แทนการเขียนไทป์สดๆ
    @Req() req: any,
  ) {
    return this.departmentService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  async findAll(@Req() req: any) {
    return this.departmentService.findAll(req.user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  async findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto, // 👈 รับเป็น DTO เพื่อให้แก้ description ได้ด้วย
    @Req() req: any,
  ) {
    return this.departmentService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.departmentService.delete(id, req.user);
  }
}
