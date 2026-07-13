import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GateService } from './gate.service';
import { GateGateway } from './gate.gateway';
import { GateController } from './gate.controller';
import { ParkingEntry, ParkingExit, Member, Payment, LostTicket, GateConfig, AuditLog, User, MemberTransaction } from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParkingEntry,
      ParkingExit,
      Member,
      Payment,
      LostTicket,
      GateConfig,
      AuditLog,
      User,
      MemberTransaction,
    ]),
  ],
  providers: [GateService, GateGateway],
  controllers: [GateController],
  exports: [GateService],
})
export class GateModule {}
