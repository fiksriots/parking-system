import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { GateModule } from '../gate/gate.module';

@Module({
  imports: [GateModule],
  controllers: [PaymentController],
})
export class PaymentModule {}
