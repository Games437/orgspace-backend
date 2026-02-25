import { IsNotEmpty, IsString, IsMongoId, IsDateString } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId({ message: 'รหัสห้อง (roomId) ไม่ถูกต้องตามรูปแบบของ MongoDB' }) // <--- ตรวจสอบ Format
  @IsNotEmpty()
  roomId: string;

  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}