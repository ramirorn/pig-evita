// ===========================================
// Competitions Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import {
  CreateCompetitionDto,
  UpdateCompetitionDto,
  CompetitionFilterDto,
  GenerateFixtureDto,
} from './dto';
import { Roles, Public, PublicReadThrottle } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';

@ApiTags('Competitions')
@Controller('competitions')
@ApiBearerAuth('access-token')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  @Roles(...ACCIONES.COMPETITION_MANAGE)
  @ApiOperation({ summary: 'Crear competencia' })
  @ApiResponse({ status: 201, description: 'Competencia creada' })
  async create(@Body() createDto: CreateCompetitionDto) {
    return this.competitionsService.create(createDto);
  }

  @Get()
  @Public() // Los fixtures/competencias se ven públicamente
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Listar competencias' })
  @ApiResponse({ status: 200, description: 'Lista de competencias paginada' })
  async findAll(@Query() filterDto: CompetitionFilterDto) {
    return this.competitionsService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener competencia y su fixture (partidos)' })
  @ApiResponse({ status: 200, description: 'Datos de la competencia' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ACCIONES.COMPETITION_MANAGE)
  @ApiOperation({ summary: 'Actualizar competencia' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCompetitionDto,
  ) {
    return this.competitionsService.update(id, updateDto);
  }

  @Post(':id/fixture')
  @Roles(...ACCIONES.COMPETITION_MANAGE)
  @ApiOperation({
    summary: 'Generar fixture automáticamente (ej. Round Robin)',
  })
  @ApiResponse({ status: 201, description: 'Fixture generado' })
  async generateFixture(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() generateDto: GenerateFixtureDto,
  ) {
    return this.competitionsService.generateFixture(id, generateDto);
  }
}
