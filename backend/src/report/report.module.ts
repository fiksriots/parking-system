import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportController } from './report.controller';
import { ParkingEntry, ParkingExit, Payment, AuditLog, MemberTransaction, LostTicket } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([ParkingEntry, ParkingExit, Payment, AuditLog, MemberTransaction, LostTicket])],
  controllers: [ReportController],
})
export class ReportModule {}
