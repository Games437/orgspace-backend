import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from 'src/common/enums/role.enum';

export class AuthDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^EMP\d{5}$/, {
    message: 'User ID ต้องขึ้นต้นด้วย EMP ตามด้วยตัวเลข 5 หลัก (เช่น EMP26016)',
  })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  password: string;

  // 👇 ต้องใส่ Decorator ให้ฟิลด์เหล่านี้ด้วย
  @IsString()
  @IsOptional()
  full_name: string;

  @IsNumber()
  @IsOptional()
  salary: number;

  @IsString()
  @IsOptional()
  position: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional() // หรือ @IsNotEmpty() ตามความต้องการ
  department?: string;
}
