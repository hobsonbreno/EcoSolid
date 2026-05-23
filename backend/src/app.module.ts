import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EcoSolidModule } from './presentation/modules/EcoSolidModule';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://root:rootpassword@localhost:27777/ecosolid_db?authSource=admin'),
    EcoSolidModule,
  ],
})
export class AppModule {}
