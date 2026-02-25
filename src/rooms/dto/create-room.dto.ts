import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุชื่อห้องประชุม' })
  name: string;

  @IsNumber()
  @IsNotEmpty({ message: 'กรุณาระบุความจุ' })
  @Min(1)
  capacity: number;

  @IsArray()
  @IsOptional()
  facilities?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  bufferTime?: number;
}
