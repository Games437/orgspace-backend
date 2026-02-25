import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PcSpec, PcSpecDocument } from './pc-spec.schema';
import { CreatePcSpecDto } from './dto/create-pc-spec.dto';

@Injectable()
export class PcSpecService {
  constructor(
    @InjectModel(PcSpec.name) private pcSpecModel: Model<PcSpecDocument>,
  ) {}

  // ฟังก์ชันสำหรับสร้างและเซฟสเปคคอมใหม่
  async create(createPcSpecDto: CreatePcSpecDto): Promise<PcSpec> {
    const createdPcSpec = new this.pcSpecModel(createPcSpecDto);
    return createdPcSpec.save();
  }

  // ฟังก์ชันสำหรับดึงข้อมูลสเปคคอมทั้งหมด (เอาไว้วาดกราฟ)
  async findAll(): Promise<PcSpec[]> {
    return this.pcSpecModel.find().exec();
  }
}