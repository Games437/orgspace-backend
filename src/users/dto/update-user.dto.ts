import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsMongoId,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsNumber()
  salary?: number;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsMongoId()
  department?: string;

  @IsOptional()
  @IsString()
  position: string;
}
