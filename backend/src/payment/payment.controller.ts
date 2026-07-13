import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { GateService } from '../gate/gate.service';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly gateService: GateService) {}

  @Get('tariff')
  getTariff() {
    return this.gateService.getTariffConfig();
  }

  @Put('tariff')
  updateTariff(@Body() body: any) {
    return this.gateService.updateTariffConfig(body);
  }

  @Post('lost-ticket')
  async processLostTicket(
    @Body()
    body: {
      gateId: string;
      entryId: string;
      identityCard: string;
      stnkNumber: string;
      operatorUsername: string;
    },
  ) {
    return this.gateService.handleLostTicketPayment(
      body.gateId,
      body.entryId,
      body.identityCard,
      body.stnkNumber,
      body.operatorUsername,
    );
  }
}
