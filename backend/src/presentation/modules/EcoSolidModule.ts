import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitizenSchema } from '../../infrastructure/database/mongo/schemas/CitizenSchema';
import { ImpactActionSchema } from '../../infrastructure/database/mongo/schemas/ImpactActionSchema';
import { BloodAlertSchema } from '../../infrastructure/database/mongo/schemas/BloodAlertSchema';
import { BenefitRedemptionSchema } from '../../infrastructure/database/mongo/schemas/BenefitRedemptionSchema';
import { MongoCitizenRepository } from '../../infrastructure/database/mongo/repositories/MongoCitizenRepository';
import { MongoImpactActionRepository } from '../../infrastructure/database/mongo/repositories/MongoImpactActionRepository';
import { EthersBlockchainService } from '../../infrastructure/blockchain/EthersBlockchainService';
import { RegisterCitizenUseCase } from '../../application/use-cases/RegisterCitizenUseCase';
import { GetCitizenUseCase } from '../../application/use-cases/GetCitizenUseCase';
import { RegisterImpactUseCase } from '../../application/use-cases/RegisterImpactUseCase';
import { CitizenController } from '../controllers/CitizenController';
import { ImpactActionController } from '../controllers/ImpactActionController';
import { BloodAlertController } from '../controllers/BloodAlertController';
import { BenefitController } from '../controllers/BenefitController';
import { AdminController } from '../controllers/AdminController';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';
import { IImpactActionRepository } from '../../domain/repositories/IImpactActionRepository';
import { IBlockchainService } from '../../application/ports/IBlockchainService';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Citizen', schema: CitizenSchema },
      { name: 'ImpactAction', schema: ImpactActionSchema },
      { name: 'BloodAlert', schema: BloodAlertSchema },
      { name: 'BenefitRedemption', schema: BenefitRedemptionSchema },
    ]),
  ],
  controllers: [CitizenController, ImpactActionController, BloodAlertController, BenefitController, AdminController],
  providers: [
    // 1. Dizendo pro NestJS quem é a Infraestrutura real que assume os Contratos
    {
      provide: 'ICitizenRepository',
      useClass: MongoCitizenRepository,
    },
    {
      provide: 'IImpactActionRepository',
      useClass: MongoImpactActionRepository,
    },
    {
      provide: 'IBlockchainService',
      useClass: EthersBlockchainService,
    },
    
    // 2. Injetando as dependências de Infraestrutura dentro da Camada de Aplicação
    {
      provide: RegisterCitizenUseCase,
      useFactory: (citizenRepo: ICitizenRepository) => {
        return new RegisterCitizenUseCase(citizenRepo);
      },
      inject: ['ICitizenRepository'],
    },
    {
      provide: GetCitizenUseCase,
      useFactory: (citizenRepo: ICitizenRepository) => {
        return new GetCitizenUseCase(citizenRepo);
      },
      inject: ['ICitizenRepository'],
    },
    {
      provide: RegisterImpactUseCase,
      useFactory: (
        citizenRepo: ICitizenRepository,
        impactRepo: IImpactActionRepository,
        blockchainSvc: IBlockchainService,
      ) => {
        return new RegisterImpactUseCase(citizenRepo, impactRepo, blockchainSvc);
      },
      inject: ['ICitizenRepository', 'IImpactActionRepository', 'IBlockchainService'],
    },
  ],
})
export class EcoSolidModule {}
