// ===========================================
// Calendar Controller
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarFilterDto,
} from './dto';
import {
  Roles,
  Public,
  CurrentUser,
  PublicReadThrottle,
} from '../../common/decorators';
import { ADMIN_ROLES } from '../../common/constants';
import { OptionalJwtAuthGuard } from '../../common/guards';
import { puedeVerBorradores } from '../../common/content-visibility';
import type { UsuarioConRol } from '../../common/content-visibility';

@ApiTags('Calendar')
@Controller('calendar')
@ApiBearerAuth('access-token')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Crear evento en el calendario' })
  @ApiResponse({ status: 201, description: 'Evento creado' })
  async create(@Body() createDto: CreateCalendarEventDto) {
    return this.calendarService.create(createDto);
  }

  /**
   * Públicos con autenticación opcional (R06): con token de un rol que
   * administra contenido se ven también los eventos sin publicar; sin token,
   * sólo los publicados. Ver `OptionalJwtAuthGuard`.
   */
  @Get()
  @Public() // Calendario público
  @UseGuards(OptionalJwtAuthGuard)
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Listar eventos del calendario' })
  @ApiResponse({ status: 200, description: 'Lista de eventos paginada' })
  async findAll(
    @Query() filterDto: CalendarFilterDto,
    @CurrentUser() user: UsuarioConRol | null,
  ) {
    return this.calendarService.findAll(filterDto, puedeVerBorradores(user));
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener evento por ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioConRol | null,
  ) {
    return this.calendarService.findOne(id, puedeVerBorradores(user));
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Actualizar evento' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Eliminar evento' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.remove(id);
  }
}
