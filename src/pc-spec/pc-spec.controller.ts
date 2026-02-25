import { Controller, Get, Post, Body } from '@nestjs/common';
import { PcSpecService } from './pc-spec.service';
import { CreatePcSpecDto } from './dto/create-pc-spec.dto';

@Controller('pc-spec') // ชื่อเส้นทาง API ของเราจะเป็น http://localhost:3000/api/pc-spec
export class PcSpecController {
  constructor(private readonly pcSpecService: PcSpecService) {}

  @Post()
  async create(@Body() createPcSpecDto: CreatePcSpecDto) {
    return this.pcSpecService.create(createPcSpecDto);
  }

  @Get()
  async findAll() {
    return this.pcSpecService.findAll();
  }
}