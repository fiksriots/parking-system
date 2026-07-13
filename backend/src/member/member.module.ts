import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberController } from './member.controller';
import { Member, MemberTransaction } from '../database/entities';
import { GateModule } from '../gate/gate.module';

@Module({
  imports: [TypeOrmModule.forFeature([Member, MemberTransaction]), GateModule],
  controllers: [MemberController],
})
export class MemberModule {}
