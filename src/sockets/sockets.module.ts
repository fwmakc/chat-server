import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '@src/account/account.module';
import { RoomsModule } from '@src/rooms/rooms.module';
import { SocketsController } from './sockets.controller';
import { SocketsEntity } from './sockets.entity';
import { SocketsGateway } from './sockets.gateway';
import { SocketsService } from './sockets.service';

@Module({
  controllers: [SocketsController],
  imports: [
    TypeOrmModule.forFeature([SocketsEntity]),
    forwardRef(() => AccountModule),
    forwardRef(() => RoomsModule),
  ],
  providers: [SocketsService, SocketsGateway],
  exports: [SocketsService],
})
export class SocketsModule {}
