import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('audit-logs')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  // ฟังก์ชันสำหรับดึง Log ทั้งหมด (เรียงจากใหม่สุดไปเก่าสุด)
  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.auditLogsService.findAll();
  }
}
