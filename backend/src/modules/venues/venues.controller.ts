// ===========================================
// Venues Controller
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
import { VenuesService } from './venues.service';
import { CreateVenueDto, UpdateVenueDto, VenueFilterDto } from './dto';
import {
  Roles,
  Public,
  CacheControl,
  CACHE_TTL,
  PublicReadThrottle,
  CurrentUser,
} from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('Venues')
@Controller('venues')
@ApiBearerAuth('access-token')
export class VenuesController {
  constructor(
    private readonly venuesService: VenuesService,
    private readonly scope: ScopeService,
  ) {}

  @Post()
  @Roles(...ACCIONES.VENUE_MANAGE)
  @ApiOperation({ summary: 'Crear sede' })
  @ApiResponse({ status: 201, description: 'Sede creada' })
  async create(
    @Body() createDto: CreateVenueDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.venuesService.create(
      createDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get()
  @Public() // Las sedes pueden ser consultadas públicamente para mapas o información general
  @PublicReadThrottle()
  @CacheControl(CACHE_TTL.CATALOG)
  @ApiOperation({ summary: 'Listar sedes' })
  @ApiResponse({ status: 200, description: 'Lista de sedes paginada' })
  async findAll(@Query() filterDto: VenueFilterDto) {
    return this.venuesService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener sede por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ACCIONES.VENUE_MANAGE)
  @ApiOperation({ summary: 'Actualizar sede' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVenueDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.venuesService.update(
      id,
      updateDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Delete(':id')
  @Roles(...ACCIONES.VENUE_MANAGE)
  @ApiOperation({ summary: 'Eliminar sede' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.venuesService.remove(id, await this.scope.alcanceDe(actor));
  }
}
