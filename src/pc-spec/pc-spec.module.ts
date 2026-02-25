import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PcSpecService } from './pc-spec.service';
import { PcSpecController } from './pc-spec.controller';
import { PcSpec, PcSpecSchema } from './pc-spec.schema';

@Module({
  // เพิ่ม MongooseModule เข้ามาตรงนี้
  imports: [
    MongooseModule.forFeature([{ name: PcSpec.name, schema: PcSpecSchema }]),
  ],
  controllers: [PcSpecController],
  providers: [PcSpecService],
})
export class PcSpecModule {}