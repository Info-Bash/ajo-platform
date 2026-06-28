import { Test, TestingModule } from '@nestjs/testing';
import { NombaService } from './nomba.service';

describe('NombaService', () => {
  let service: NombaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NombaService],
    }).compile();

    service = module.get<NombaService>(NombaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
