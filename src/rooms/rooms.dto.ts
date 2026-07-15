import { ApiProperty } from '@nestjs/swagger';
import { DtoColumn } from '@src/common/common.column';
import { CommonDto } from '@src/common/common.dto';
import { SocketsDto } from '@src/sockets/sockets.dto';

export class RoomsDto extends CommonDto {
  @DtoColumn('Название комнаты')
  title?: string;

  @ApiProperty({
    required: false,
    description: 'Данные сокетов, связанных с данной комнатой',
    type: () => [SocketsDto],
  })
  sockets?: SocketsDto[];
}
