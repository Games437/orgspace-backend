import { IsNotEmpty, IsString, IsISO8601 } from 'class-validator';

export class CreateBookingDto {
  @IsNotEmpty()
  @IsString()
  roomName: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsISO8601()
  startTime: string;

  @IsNotEmpty()
  @IsISO8601()
  endTime: string;
}
