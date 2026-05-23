import { Controller, Post, Body, Get, Param, Inject } from '@nestjs/common';
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

  @Get(':wallet')
  async getByWallet(@Param('wallet') wallet: string) {
    try {
      const citizen = await this.getUseCase.execute(wallet);
      if (!citizen) return { success: false, error: 'Cidadão não encontrado' };
      return { success: true, data: citizen };
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

  @Post('biometric/login')
  async loginBiometric(@Body() body: { credentialId: string }) {
    try {
      const citizen = await this.citizenRepo.findByCredentialId(body.credentialId);
      if (!citizen) return { success: false, error: 'Biometria não encontrada. Faça login com MetaMask primeiro.' };

      return { success: true, data: citizen };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
