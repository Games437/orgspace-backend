import { Test, TestingModule } from '@nestjs/testing';
import { PcSpecService } from './pc-spec.service';

describe('PcSpecService', () => {
  let service: PcSpecService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PcSpecService],
    }).compile();

    service = module.get<PcSpecService>(PcSpecService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
