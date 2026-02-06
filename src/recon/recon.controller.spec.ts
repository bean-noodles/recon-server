import { Test, TestingModule } from '@nestjs/testing';
import { ReconController } from './recon.controller';

describe('ReconController', () => {
  let controller: ReconController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconController],
    }).compile();

    controller = module.get<ReconController>(ReconController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
