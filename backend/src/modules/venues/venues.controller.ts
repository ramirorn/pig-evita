// ===========================================
// Venues Controller
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
import { VenuesService } from './venues.service';
import { CreateVenueDto, UpdateVenueDto, VenueFilterDto } from './dto';
import { Roles, Public } from '../../common/decorators';
import { ADMIN_ROLES } from '../../common/constants';

@ApiTags('Venues')
@Controller('venues')
@ApiBearerAuth('access-token')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Crear sede' })
  @ApiResponse({ status: 201, description: 'Sede creada' })
  async create(@Body() createDto: CreateVenueDto) {
    return this.venuesService.create(createDto);
  }

  @Get()
  @Public() // Las sedes pueden ser consultadas públicamente para mapas o información general
  @ApiOperation({ summary: 'Listar sedes' })
  @ApiResponse({ status: 200, description: 'Lista de sedes paginada' })
  async findAll(@Query() filterDto: VenueFilterDto) {
    return this.venuesService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener sede por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Actualizar sede' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVenueDto,
  ) {
    return this.venuesService.update(id, updateDto);
  }
}
