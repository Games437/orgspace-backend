import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentDto } from './create-department.dto';

// PartialType จะทำให้ name และ description กลายเป็นฟิลด์ที่ไม่บังคับ (Optional)
// แต่ถ้าส่งมา ก็ยังต้องผ่านกฎ @IsString และ @MinLength เหมือนเดิม
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}