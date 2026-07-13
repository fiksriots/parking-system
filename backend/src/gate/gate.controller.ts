import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GateConfig } from '../database/entities';

@Controller('api/gates')
export class GateController {
  constructor(
    @InjectRepository(GateConfig)
    private readonly gateRepo: Repository<GateConfig>,
  ) {}

  @Get()
  async getGates() {
    return this.gateRepo.find({ order: { name: 'ASC' } });
  }

  @Post()
  async createGate(@Body() gateData: Partial<GateConfig>) {
    const gate = this.gateRepo.create(gateData);
    return this.gateRepo.save(gate);
  }

  @Put(':id')
  async updateGate(@Param('id') id: string, @Body() gateData: Partial<GateConfig>) {
    await this.gateRepo.update(id, gateData);
    return this.gateRepo.findOne({ where: { id } });
  }

  @Get('settings')
  async getSettings() {
    const fs = require('fs');
    const path = require('path');
    const settingsFilePath = path.join(process.cwd(), 'settings.json');
    
    if (!fs.existsSync(settingsFilePath)) {
      fs.writeFileSync(settingsFilePath, JSON.stringify({ systemMode: 'simulation', operatorPrinterIp: '192.168.1.150' }));
    }
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
      return {
        systemMode: settings.systemMode || 'simulation',
        operatorPrinterIp: settings.operatorPrinterIp || '192.168.1.150',
      };
    } catch (e) {
      return { systemMode: 'simulation', operatorPrinterIp: '192.168.1.150' };
    }
  }

  @Post('settings')
  async saveSettings(@Body() body: { systemMode: string; operatorPrinterIp?: string }) {
    const fs = require('fs');
    const path = require('path');
    const settingsFilePath = path.join(process.cwd(), 'settings.json');
    
    const settings = {
      systemMode: body.systemMode || 'simulation',
      operatorPrinterIp: body.operatorPrinterIp || '192.168.1.150',
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings));
    return { success: true, ...settings };
  }

  @Delete(':id')
  async deleteGate(@Param('id') id: string) {
    await this.gateRepo.delete(id);
    return { success: true };
  }
}
