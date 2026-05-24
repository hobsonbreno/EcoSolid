import { Controller, Post, Body, Get, Param, Inject, Headers } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegisterImpactUseCase } from '../../application/use-cases/RegisterImpactUseCase';
import { RegisterImpactDto } from '../../application/dtos/RegisterImpactDto';
import type { IBlockchainService } from '../../application/ports/IBlockchainService';
import type { IImpactActionRepository } from '../../domain/repositories/IImpactActionRepository';
import type { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';

@Controller('impact')
export class ImpactActionController {
  constructor(
    private readonly registerImpactUseCase: RegisterImpactUseCase,
    @Inject('IImpactActionRepository') private readonly impactRepo: IImpactActionRepository,
    @Inject('ICitizenRepository') private readonly citizenRepo: ICitizenRepository,
    @Inject('IBlockchainService') private readonly blockchainService: IBlockchainService,
    @InjectModel('ImpactAction') private readonly impactModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  @Post('register')
  async registerImpact(@Body() dto: RegisterImpactDto) {
    try {
      const result = await this.registerImpactUseCase.execute(dto);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('citizen/:citizenId')
  async getHistory(@Param('citizenId') citizenId: string) {
    try {
      const actions = await this.impactRepo.findByCitizenId(citizenId);
      return { success: true, data: actions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post(':id/validate')
  async validateAction(
    @Param('id') id: string,
    @Headers('x-partner-code') partnerCode: string,
  ) {
    try {
      if (!partnerCode) return { success: false, error: 'x-partner-code header obrigatório' };

      const action = await this.impactModel.findById(id);
      if (!action) return { success: false, error: 'Ação não encontrada' };
      if (action.status !== 'PENDENTE_VALIDACAO') return { success: false, error: 'Ação já foi processada' };

      // Gravar na blockchain Sepolia
      const citizen = await this.citizenModel.findById(action.citizenId);
      const citizenAddress = citizen?.walletAddress || '0x0000000000000000000000000000000000000000';
      const txHash = await this.blockchainService.registerAction(
        id,
        citizenAddress,
        action.pointsEarned,
        action.actionType,
      );

      // Creditar SOLID ao cidadão
      if (citizen) {
        citizen.totalPoints = (citizen.totalPoints || 0) + action.pointsEarned;
        // Atualizar nível
        if (citizen.totalPoints >= 3000) citizen.level = 'FOREST';
        else if (citizen.totalPoints >= 1000) citizen.level = 'TREE';
        else if (citizen.totalPoints >= 500) citizen.level = 'SPROUT';
        else if (citizen.totalPoints >= 100) citizen.level = 'SEED';
        await citizen.save();
      }

      // Atualizar ação
      action.status = 'VALIDADO';
      action.txHash = txHash;
      await action.save();

      return { success: true, data: { action, txHash }, message: 'Ação validada e blockchain registrada!' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post(':id/reject')
  async rejectAction(
    @Param('id') id: string,
    @Headers('x-partner-code') partnerCode: string,
  ) {
    try {
      if (!partnerCode) return { success: false, error: 'x-partner-code header obrigatório' };

      const action = await this.impactModel.findById(id);
      if (!action) return { success: false, error: 'Ação não encontrada' };
      if (action.status !== 'PENDENTE_VALIDACAO') return { success: false, error: 'Ação já foi processada' };

      action.status = 'REJEITADO';
      await action.save();

      return { success: true, data: action, message: 'Ação rejeitada' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('pending')
  async getPending() {
    try {
      const actions = await this.impactModel
        .find({ status: 'PENDENTE_VALIDACAO' })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
      return { success: true, data: actions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('pending/partner/:partnerCode')
  async getPendingByPartner(@Param('partnerCode') partnerCode: string) {
    try {
      const actions = await this.impactModel
        .find({ status: 'PENDENTE_VALIDACAO', validatorId: partnerCode })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
      return { success: true, data: actions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
