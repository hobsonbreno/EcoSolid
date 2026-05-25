import { Controller, Post, Body, Get, Patch, Param, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CitizenDocument } from '../../infrastructure/database/mongo/schemas/CitizenSchema';
import { RegisterCitizenUseCase } from '../../application/use-cases/RegisterCitizenUseCase';
import { GetCitizenUseCase } from '../../application/use-cases/GetCitizenUseCase';
import { RegisterCitizenDto } from '../../application/dtos/RegisterCitizenDto';
import type { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';

@Controller('citizens')
export class CitizenController {
  constructor(
    private readonly registerUseCase: RegisterCitizenUseCase,
    private readonly getUseCase: GetCitizenUseCase,
    @Inject('ICitizenRepository') private readonly citizenRepo: ICitizenRepository,
    @InjectModel('Citizen') private readonly citizenModel: Model<CitizenDocument>,
  ) {}

  @Post()
  async register(@Body() dto: RegisterCitizenDto) {
    try {
      const citizen = await this.registerUseCase.execute(dto);
      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('by-email/:email')
  async getByEmail(@Param('email') email: string) {
    try {
      const citizen = await this.citizenRepo.findByEmail(email);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };
      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('blood-type/:type')
  async getByBloodType(@Param('type') type: string) {
    try {
      const bloodType = type.toUpperCase();
      // Buscar cidadãos com bloodType OU que doaram sangue daquele tipo
      const impactModel = (this.citizenModel as any).db?.model('ImpactAction') ||
        require('mongoose').model('ImpactAction');
      const donors = await impactModel
        .find({ actionType: 'BLOOD_DONATION', bloodType })
        .distinct('citizenId')
        .lean()
        .exec()
        .catch(() => []);

      const query: any = { $or: [{ bloodType }] };
      if (donors.length > 0) {
        query.$or.push({ _id: { $in: donors } });
      }

      const docs = await this.citizenModel.find(query).lean().exec();
      return { success: true, data: docs, count: docs.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      const citizen = await this.citizenRepo.findById(id);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };
      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('wallet/:wallet')
  async getByWallet(@Param('wallet') wallet: string) {
    try {
      const citizen = await this.getUseCase.execute(wallet);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };
      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id')
  async updateCitizen(@Param('id') id: string, @Body() body: any) {
    try {
      const allowedFields = ['bloodType', 'phone', 'email', 'address', 'pixKey', 'pixKeyType'];
      const update: any = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) update[key] = body[key];
      }
      if (Object.keys(update).length === 0) return { success: false, error: 'Nenhum campo válido para atualizar' };

      const citizen = await this.citizenModel.findByIdAndUpdate(id, update, { new: true }).lean().exec();
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };
      return { success: true, data: citizen, message: 'Dados atualizados com sucesso!' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('biometric/register')
  async registerBiometric(@Body() body: { citizenId: string; credentialId: string; credentialPublicKey: string }) {
    try {
      const citizen = await this.citizenRepo.findById(body.citizenId);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };

      citizen.credentialId = body.credentialId;
      citizen.credentialPublicKey = body.credentialPublicKey;
      await this.citizenRepo.save(citizen);

      return { success: true, message: 'Biometria registrada com sucesso' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id/push-token')
  async savePushToken(@Param('id') id: string, @Body() body: { pushToken: any }) {
    try {
      await this.citizenModel.findByIdAndUpdate(id, { pushToken: body.pushToken });
      return { success: true, message: 'Push token salvo' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id/wallet')
  async addWallet(@Param('id') id: string, @Body() body: { walletAddress: string; type?: string }) {
    try {
      const citizen = await this.citizenRepo.findById(id);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };

      const dupe = await this.citizenRepo.findByWallet(body.walletAddress);
      if (dupe && dupe.id !== id) return { success: false, error: 'Esta carteira já está vinculada a outra conta.' };

      citizen.walletAddress = body.walletAddress;
      await this.citizenRepo.save(citizen);

      return { success: true, data: citizen, message: `Carteira ${body.type || ''} vinculada com sucesso` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('biometric/login')
  async loginBiometric(@Body() body: { credentialId: string }) {
    try {
      const citizen = await this.citizenRepo.findByCredentialId(body.credentialId);
      if (!citizen) return { success: false, error: 'Biometria não encontrada. Faça login primeiro.' };

      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
