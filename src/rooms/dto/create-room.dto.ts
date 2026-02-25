import { IsString, IsNotEmpty, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุชื่อห้องประชุม' })
  name: string;

  @IsNumber()
  @IsNotEmpty({ message: 'กรุณาระบุความจุ' })
  capacity: number;

  @IsArray()
  @IsOptional()
  facilities?: string[];
}