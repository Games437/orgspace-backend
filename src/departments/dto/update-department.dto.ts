import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentDto } from './create-department.dto';

/* PartialType จะแปลงทุก Property ใน CreateDepartmentDto ให้เป็น Optional (?) *
 * แต่ยังคงรักษา Validation Decorators (เช่น @IsString, @MinLength) เอาไว้ทั้งหมด */
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
