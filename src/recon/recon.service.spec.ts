import { Test, TestingModule } from '@nestjs/testing';
import { ReconService } from './recon.service';

describe('ReconService', () => {
  let service: ReconService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReconService],
    }).compile();

    service = module.get<ReconService>(ReconService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
