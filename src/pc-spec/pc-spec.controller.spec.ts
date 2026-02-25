import { Test, TestingModule } from '@nestjs/testing';
import { PcSpecController } from './pc-spec.controller';

describe('PcSpecController', () => {
  let controller: PcSpecController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PcSpecController],
    }).compile();

    controller = module.get<PcSpecController>(PcSpecController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
