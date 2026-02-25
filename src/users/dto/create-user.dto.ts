import {
  IsString,
  IsEnum,
  IsNumber,
  MinLength,
  IsMongoId,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  userId: string;

  @MinLength(6)
  password: string;

  @IsString()
  full_name: string;

  @IsNumber()
  salary: number;

  @IsEnum(Role)
  role: Role;

  @IsString()
  department: string;

  @IsString()
  position: string;
}
