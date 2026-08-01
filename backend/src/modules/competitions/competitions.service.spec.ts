import { Test, TestingModule } from '@nestjs/testing';
import { CompetitionsService } from './competitions.service';
import { PrismaService } from '../../database/prisma.service';
import { EngineFactory, RoundRobinEngine } from './engine.factory';

describe('CompetitionsService', () => {
  let service: CompetitionsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetitionsService,
        EngineFactory,
        RoundRobinEngine,
        {
          provide: PrismaService,
          useValue: {
            competition: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            category: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CompetitionsService>(CompetitionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw an error if category does not belong to discipline', async () => {
      // Mock category lookup returning wrong discipline
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat-id',
        disciplineId: 'wrong-disc-id',
      });

      await expect(
        service.create({
          disciplineId: 'disc-id',
          categoryId: 'cat-id',
          stage: 'ZONAL',
          format: 'ROUND_ROBIN',
        }),
      ).rejects.toThrow('Categoría inválida para la disciplina seleccionada');
    });

    it('should create competition if validation passes', async () => {
      // Mock existing competition check (not found)
      (prisma.competition.findUnique as jest.Mock).mockResolvedValue(null);
      // Mock category lookup
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat-id',
        disciplineId: 'disc-id',
      });
      // Mock create
      const expectedComp = { id: 'comp-1', format: 'ROUND_ROBIN' };
      (prisma.competition.create as jest.Mock).mockResolvedValue(expectedComp);

      const result = await service.create({
        disciplineId: 'disc-id',
        categoryId: 'cat-id',
        stage: 'ZONAL',
        format: 'ROUND_ROBIN',
      });

      expect(result).toEqual(expectedComp);
      expect(prisma.competition.create).toHaveBeenCalled();
    });
  });
});
