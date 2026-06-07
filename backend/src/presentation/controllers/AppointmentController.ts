import { Controller, Post, Body, Get, Patch, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('appointments')
export class AppointmentController {
  constructor(
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
  ) {}

  @Post()
  async create(
    @Body()
    body: {
      citizenId: string;
      citizenName: string;
      date: string;
      time: string;
      notes?: string;
      location?: string;
    },
  ) {
    try {
      const appointment = await this.appointmentModel.create({
        citizenId: body.citizenId,
        citizenName: body.citizenName,
        date: body.date,
        time: body.time,
        notes: body.notes || '',
        location: body.location || 'HemoSangue CE',
        status: 'agendado',
      });
      return {
        success: true,
        data: appointment,
        message: 'Agendamento criado com sucesso!',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get()
  async listAll() {
    try {
      const appointments = await this.appointmentModel
        .find()
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: appointments };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('citizen/:citizenId')
  async getByCitizen(@Param('citizenId') citizenId: string) {
    try {
      const appointment = await this.appointmentModel
        .findOne({ citizenId, status: { $in: ['agendado', 'confirmado'] } })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: appointment || null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    try {
      const validStatuses = [
        'agendado',
        'confirmado',
        'realizado',
        'cancelado',
      ];
      if (!validStatuses.includes(body.status)) {
        return {
          success: false,
          error:
            'Status inválido. Use: agendado, confirmado, realizado, cancelado',
        };
      }
      const appointment = await this.appointmentModel
        .findByIdAndUpdate(id, { status: body.status }, { new: true })
        .lean()
        .exec();
      if (!appointment)
        return { success: false, error: 'Agendamento não encontrado' };
      return {
        success: true,
        data: appointment,
        message: `Status atualizado para ${body.status}`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
