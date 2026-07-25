import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import type { CreateAppointmentInput } from "@/validators/appointment.validator";

export const appointmentService = {
  async create(patientId: string, input: CreateAppointmentInput) {
    if (input.doctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId } });
      if (!doctor) throw ApiError.badRequest("Selected doctor does not exist");
    }
    return prisma.appointment.create({
      data: {
        patientId,
        doctorId: input.doctorId,
        scheduledAt: input.scheduledAt,
        reason: input.reason,
      },
    });
  },

  async listForPatient(patientId: string) {
    return prisma.appointment.findMany({
      where: { patientId },
      orderBy: { scheduledAt: "asc" },
      include: { doctor: { include: { user: true } } },
    });
  },

  async updateStatus(id: string, status: string) {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Appointment not found");
    return prisma.appointment.update({ where: { id }, data: { status: status as never } });
  },
};
