import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString({ message: 'ชื่อแผนกต้องเป็นตัวอักษร' })
  @IsNotEmpty({ message: 'กรุณาระบุชื่อแผนก' })
  name: string;

  @IsString({ message: 'รายละเอียดต้องเป็นตัวอักษร' })
  @IsNotEmpty({ message: 'กรุณาระบุรายละเอียดแผนก' })
  @MinLength(10, { message: 'รายละเอียดต้องมีความยาวอย่างน้อย 10 ตัวอักษร' })
  description: string;
}
