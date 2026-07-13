import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { User, CashierShift, Payment, MemberTransaction, ParkingEntry } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, CashierShift, Payment, MemberTransaction, ParkingEntry])],
  controllers: [UserController],
})
export class UserModule {}
