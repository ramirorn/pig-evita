// ===========================================
// Disciplines Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { DisciplinesService } from './disciplines.service';
import {
  CreateDisciplineDto,
  UpdateDisciplineDto,
  DisciplineFilterDto,
} from './dto';
import {
  Roles,
  Public,
  CacheControl,
  CACHE_TTL,
} from '../../common/decorators';
import { Role } from '../../common/constants';

@ApiTags('Disciplines')
@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Crear disciplina',
    description: 'Solo Super Admin y Admin Provincial.',
  })
  @ApiResponse({ status: 201, description: 'Disciplina creada' })
  async create(@Body() createDto: CreateDisciplineDto) {
    return this.disciplinesService.create(createDto);
  }

  @Get()
  @Public() // Lista de disciplinas puede ser consultada sin login para armar combos en frontend
  @CacheControl(CACHE_TTL.CATALOG)
  @ApiOperation({
    summary: 'Listar disciplinas',
    description: 'Endpoint público. Paginado y filtrado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de disciplinas' })
  async findAll(@Query() filterDto: DisciplineFilterDto) {
    return this.disciplinesService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Obtener disciplina',
    description: 'Incluye sus categorías asociadas.',
  })
  @ApiResponse({ status: 200, description: 'Datos de la disciplina' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.disciplinesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar disciplina' })
  @ApiResponse({ status: 200, description: 'Disciplina actualizada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDisciplineDto,
  ) {
    return this.disciplinesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar disciplina' })
  @ApiResponse({ status: 200, description: 'Disciplina eliminada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.disciplinesService.remove(id);
  }
}
