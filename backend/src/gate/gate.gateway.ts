import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GateService } from './gate.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gateService: GateService) {
    // Subscribe to GateService events and broadcast them to all WebSocket clients
    this.gateService.on('gate_event', (data) => {
      this.server.emit('gate_event', data);
    });

    this.gateService.on('gate_action', (data) => {
      this.server.emit('gate_action', data);
    });

    this.gateService.on('gate_error', (data) => {
      this.server.emit('gate_error', data);
    });

    this.gateService.on('audit_log_added', () => {
      this.server.emit('audit_log_added');
    });
  }

  handleConnection(client: Socket) {
    console.log(`WebSocket Client Connected: ${client.id}`);
    // Emit current gates list on connect
    this.gateService.getGates().then((gates) => {
      client.emit('gates_list', gates);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`WebSocket Client Disconnected: ${client.id}`);
  }

  @SubscribeMessage('car_arrived')
  async handleCarArrived(@MessageBody() data: { gateId: string }) {
    await this.gateService.handleCarArrival(data.gateId, true);
  }

  @SubscribeMessage('car_departed')
  async handleCarDeparted(@MessageBody() data: { gateId: string }) {
    await this.gateService.handleCarArrival(data.gateId, false);
  }

  @SubscribeMessage('press_ticket_button')
  async handlePressTicketButton(
    @MessageBody() data: { gateId: string; plateNumber: string; cameraPhoto: string; vehicleType?: string },
  ) {
    const result = await this.gateService.handleTicketRequest(
      data.gateId,
      data.plateNumber,
      data.cameraPhoto,
      data.vehicleType || 'car',
    );
    return result;
  }

  @SubscribeMessage('tap_rfid')
  async handleTapRfid(
    @MessageBody() data: { gateId: string; rfidCardNumber: string; cameraPhoto: string },
  ) {
    const result = await this.gateService.handleRfidTap(
      data.gateId,
      data.rfidCardNumber,
      data.cameraPhoto,
    );
    return result;
  }

  @SubscribeMessage('verify_ticket')
  async handleVerifyTicket(@MessageBody() data: { ticketCode: string }) {
    const result = await this.gateService.checkTicketStatus(data.ticketCode);
    return result;
  }

  @SubscribeMessage('make_payment')
  async handleMakePayment(
    @MessageBody() data: {
      gateId: string;
      ticketCode: string;
      paymentMethod: string;
      amount: number;
      cameraPhoto: string;
      plateNumber?: string;
    },
  ) {
    const result = await this.gateService.handlePaymentAndExit(
      data.gateId,
      data.ticketCode,
      data.paymentMethod,
      data.amount,
      data.cameraPhoto,
      data.plateNumber,
    );
    return result;
  }
}
