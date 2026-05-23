import { Controller, Post, Body, Get, Param, Inject } from '@nestjs/common';
import { RegisterImpactUseCase } from '../../application/use-cases/RegisterImpactUseCase';
import { RegisterImpactDto } from '../../application/dtos/RegisterImpactDto';
import type { IImpactActionRepository } from '../../domain/repositories/IImpactActionRepository';

@Controller('impact')
export class ImpactActionController {
  constructor(
    private readonly registerImpactUseCase: RegisterImpactUseCase,
    @Inject('IImpactActionRepository') private readonly impactRepo: IImpactActionRepository,
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
}
