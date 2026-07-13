import { Controller, Get, Post, Put, Delete, Body, Param, Patch } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Member, MemberTransaction } from '../database/entities';
import { GateService } from '../gate/gate.service';

@Controller('api/members')
export class MemberController {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(MemberTransaction)
    private readonly transactionRepo: Repository<MemberTransaction>,
    private readonly gateService: GateService,
  ) {}

  @Get()
  async getMembers() {
    return this.memberRepo.find({ order: { createdAt: 'DESC' } });
  }

  // GET daily rekap transactions & registrations
  @Get('transactions/rekap')
  async getDailyRekap() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transactions = await this.transactionRepo.find({
      where: {
        timestamp: MoreThanOrEqual(today)
      },
      order: { timestamp: 'DESC' }
    });

    return transactions;
  }

  @Post()
  async createMember(@Body() memberData: any) {
    const member = this.memberRepo.create({
      name:           memberData.name,
      rfidCardNumber: memberData.rfidCardNumber,
      memberType:     memberData.memberType || 'monthly',
      expiryDate:     memberData.expiryDate ? new Date(memberData.expiryDate) : undefined,
      quotaTotal:     memberData.quotaTotal  ? Number(memberData.quotaTotal)  : 0,
      quotaUsed:      0,
      identityCard:   memberData.identityCard || '',
      phoneNumber:    memberData.phoneNumber  || '',
      email:          memberData.email        || '',
      status:         memberData.status || 'active',
    });

    const savedMember = await this.memberRepo.save(member);

    // Save transaction
    const amount = Number(memberData.amount) || 0;
    const operator = memberData.operatorUsername || 'operator';
    const details = savedMember.memberType === 'monthly'
      ? `Masa berlaku awal s/d ${savedMember.expiryDate ? new Date(savedMember.expiryDate).toLocaleDateString('id-ID') : '—'}`
      : `Kuota awal ${savedMember.quotaTotal}x masuk`;

    await this.transactionRepo.save({
      memberId: savedMember.id,
      memberName: savedMember.name,
      rfidCardNumber: savedMember.rfidCardNumber,
      transactionType: 'registration',
      amount,
      details,
      operatorUsername: operator,
    });

    // Print Receipt if in production mode
    const systemMode = this.gateService.getSystemMode();
    const printerIp = this.gateService.getOperatorPrinterIp();
    const cleanDate = new Date().toLocaleString('id-ID');

    const receiptLines = [
      '--------------------------------',
      '         PARKING MEMBER         ',
      '      REGISTRATION RECEIPT      ',
      '--------------------------------',
      `Tanggal    : ${cleanDate}`,
      `Operator   : ${operator}`,
      `Nama       : ${savedMember.name}`,
      `Card RFID  : ${savedMember.rfidCardNumber}`,
      `Jenis      : ${savedMember.memberType === 'monthly' ? 'Member Bulanan' : 'Member Kuota'}`,
      `Detail     : ${details}`,
      `Biaya      : Rp ${amount.toLocaleString('id-ID')}`,
      `Status     : ${savedMember.status.toUpperCase()}`,
      '--------------------------------',
      '          TERIMA KASIH          ',
      '--------------------------------',
    ];

    if (systemMode === 'production') {
      await this.gateService.printToNetworkPrinter(printerIp, receiptLines);
    }

    return { success: true, member: savedMember, receipt: receiptLines };
  }

  @Put(':id')
  async updateMember(@Param('id') id: string, @Body() memberData: any) {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) return { success: false, message: 'Member tidak ditemukan' };

    const oldType = member.memberType || 'monthly';
    const newType = memberData.memberType || oldType;

    const updateData: any = { ...memberData };
    
    // We protect quotaTotal/quotaUsed from being modified unless it's a memberType conversion!
    delete updateData.quotaTotal;
    delete updateData.quotaUsed;
    delete updateData.amount;
    delete updateData.operatorUsername;

    if (oldType !== newType) {
      updateData.memberType = newType;
      if (newType === 'quota') {
        updateData.expiryDate = null;
        updateData.quotaTotal = Number(memberData.quotaTotal) || 10;
        updateData.quotaUsed = 0;
      } else {
        updateData.expiryDate = memberData.expiryDate ? new Date(memberData.expiryDate) : new Date(Date.now() + 30 * 86400000);
        updateData.quotaTotal = 0;
        updateData.quotaUsed = 0;
      }

      // Log type change transaction
      const conversionAmount = Number(memberData.amount) || 0;
      const operator = memberData.operatorUsername || 'operator';
      const details = `Ubah tipe dari ${oldType.toUpperCase()} ke ${newType.toUpperCase()}`;

      await this.transactionRepo.save({
        memberId: member.id,
        memberName: member.name,
        rfidCardNumber: member.rfidCardNumber,
        transactionType: 'change_type',
        amount: conversionAmount,
        details,
        operatorUsername: operator,
      });

      // Print Receipt for Change Type
      const systemMode = this.gateService.getSystemMode();
      const printerIp = this.gateService.getOperatorPrinterIp();
      const cleanDate = new Date().toLocaleString('id-ID');

      const receiptLines = [
        '--------------------------------',
        '         PARKING MEMBER         ',
        '       CONVERSION RECEIPT       ',
        '--------------------------------',
        `Tanggal    : ${cleanDate}`,
        `Operator   : ${operator}`,
        `Nama       : ${member.name}`,
        `Card RFID  : ${member.rfidCardNumber}`,
        `Ubah Mode  : ${oldType.toUpperCase()} -> ${newType.toUpperCase()}`,
        `Biaya Admin: Rp ${conversionAmount.toLocaleString('id-ID')}`,
        '--------------------------------',
        '          TERIMA KASIH          ',
        '--------------------------------',
      ];

      if (systemMode === 'production') {
        await this.gateService.printToNetworkPrinter(printerIp, receiptLines);
      }

      await this.memberRepo.update(id, updateData);
      const updated = await this.memberRepo.findOne({ where: { id } });
      return { success: true, member: updated, receipt: receiptLines };
    }

    if (memberData.expiryDate && newType === 'monthly') {
      updateData.expiryDate = new Date(memberData.expiryDate);
    }

    await this.memberRepo.update(id, updateData);
    const updated = await this.memberRepo.findOne({ where: { id } });
    return { success: true, member: updated };
  }

  // Top-up quota: add more entries to quota member
  @Patch(':id/topup-quota')
  async topupQuota(@Param('id') id: string, @Body() body: any) {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) return { success: false, message: 'Member tidak ditemukan' };
    
    const addQuota = Number(body.addQuota) || 0;
    const amount = Number(body.amount) || 0;
    const operator = body.operatorUsername || 'operator';

    member.quotaTotal = (member.quotaTotal || 0) + addQuota;
    const savedMember = await this.memberRepo.save(member);

    // Save transaction record
    await this.transactionRepo.save({
      memberId: savedMember.id,
      memberName: savedMember.name,
      rfidCardNumber: savedMember.rfidCardNumber,
      transactionType: 'topup_quota',
      amount,
      details: `Tambah ${addQuota}x Masuk`,
      operatorUsername: operator,
    });

    // Print top-up receipt
    const systemMode = this.gateService.getSystemMode();
    const printerIp = this.gateService.getOperatorPrinterIp();
    const cleanDate = new Date().toLocaleString('id-ID');

    const receiptLines = [
      '--------------------------------',
      '         PARKING MEMBER         ',
      '         TOP-UP RECEIPT         ',
      '--------------------------------',
      `Tanggal    : ${cleanDate}`,
      `Operator   : ${operator}`,
      `Nama       : ${savedMember.name}`,
      `Card RFID  : ${savedMember.rfidCardNumber}`,
      'Jenis      : Member Kuota',
      `Detail     : Tambah ${addQuota}x Masuk`,
      `Total Sisa : ${savedMember.quotaTotal - savedMember.quotaUsed}x masuk`,
      `Biaya      : Rp ${amount.toLocaleString('id-ID')}`,
      '--------------------------------',
      '          TERIMA KASIH          ',
      '--------------------------------',
    ];

    if (systemMode === 'production') {
      await this.gateService.printToNetworkPrinter(printerIp, receiptLines);
    }

    return { success: true, member: savedMember, receipt: receiptLines };
  }

  // Renew monthly member: extend expiry date by N months
  @Patch(':id/renew')
  async renewMember(@Param('id') id: string, @Body() body: any) {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) return { success: false, message: 'Member tidak ditemukan' };
    if (member.memberType === 'quota') {
      return { success: false, message: 'Endpoint ini hanya untuk member bulanan' };
    }

    const months = Number(body.addMonths) || 1;
    const amount = Number(body.amount) || 0;
    const operator = body.operatorUsername || 'operator';

    // Extend expiry date
    const baseDate = member.expiryDate && new Date(member.expiryDate) > new Date()
      ? new Date(member.expiryDate)
      : new Date();

    baseDate.setMonth(baseDate.getMonth() + months);
    member.expiryDate = baseDate;

    // Reactivate if suspended/expired
    if (member.status !== 'active') {
      member.status = 'active';
    }

    const savedMember = await this.memberRepo.save(member);

    // Save transaction record
    await this.transactionRepo.save({
      memberId: savedMember.id,
      memberName: savedMember.name,
      rfidCardNumber: savedMember.rfidCardNumber,
      transactionType: 'renew_monthly',
      amount,
      details: `Tambah ${months} Bulan`,
      operatorUsername: operator,
    });

    // Print renewal receipt
    const systemMode = this.gateService.getSystemMode();
    const printerIp = this.gateService.getOperatorPrinterIp();
    const cleanDate = new Date().toLocaleString('id-ID');

    const receiptLines = [
      '--------------------------------',
      '         PARKING MEMBER         ',
      '        RENEWAL RECEIPT         ',
      '--------------------------------',
      `Tanggal    : ${cleanDate}`,
      `Operator   : ${operator}`,
      `Nama       : ${savedMember.name}`,
      `Card RFID  : ${savedMember.rfidCardNumber}`,
      'Jenis      : Member Bulanan',
      `Detail     : Perpanjang ${months} Bulan`,
      `Masa Baru  : ${baseDate.toLocaleDateString('id-ID')}`,
      `Biaya      : Rp ${amount.toLocaleString('id-ID')}`,
      '--------------------------------',
      '          TERIMA KASIH          ',
      '--------------------------------',
    ];

    if (systemMode === 'production') {
      await this.gateService.printToNetworkPrinter(printerIp, receiptLines);
    }

    return { success: true, member: savedMember, newExpiryDate: baseDate, receipt: receiptLines };
  }

  @Delete(':id')
  async deleteMember(@Param('id') id: string) {
    await this.memberRepo.delete(id);
    return { success: true };
  }
}
