import { BaseEntity, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RoomsEntity } from '@src/rooms/rooms.entity';
import { UsersEntity } from '@src/db/users/users.entity';
import { AccountEntity } from '@src/account/account.entity';
import {
  IdColumn,
  JsonColumn,
  TextColumn,
  VarcharColumn,
} from '@src/common/common.column';

@Entity({ name: 'sockets' })
export class SocketsEntity extends BaseEntity {
  @IdColumn()
  id: number;

  @ManyToOne(() => AccountEntity)
  @JoinColumn({ name: 'account_id', referencedColumnName: 'id' })
  account: AccountEntity;

  @VarcharColumn('name')
  name?: string;

  @JsonColumn('data')
  data?: string;

  @TextColumn('message')
  message?: string;

  @ManyToOne(() => RoomsEntity, (room) => room.sockets, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id', referencedColumnName: 'id' })
  room: UsersEntity;
}
