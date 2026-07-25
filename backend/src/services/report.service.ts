import PDFDocument from "pdfkit";
import type { Response } from "express";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";

/**
 * Streams a PDF triage report directly to the response — deliberately not
 * buffered in memory first, so this stays cheap even for large reports.
 */
export const reportService = {
  async streamAssessmentReport(assessmentId: string, res: Response) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        patient: { include: { user: true } },
        recommendation: true,
        symptoms: true,
        ruleTriggers: { include: { rule: true } },
      },
    });
    if (!assessment) throw ApiError.notFound("Assessment not found");

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="triage-report-${assessment.id}.pdf"`
    );
    doc.pipe(res);

    doc
      .fontSize(18)
      .fillColor("#1E5DAA")
      .text("Patient Triage Report", { align: "left" })
      .moveDown(0.3);

    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(`Generated ${new Date().toLocaleString()} · Assessment ID ${assessment.id}`)
      .moveDown(1);

    const patientName = `${assessment.patient.user.firstName} ${assessment.patient.user.lastName}`;
    doc.fontSize(12).fillColor("#000000").text("Patient", { underline: true });
    doc.fontSize(10).text(`Name: ${patientName}`);
    doc.text(`Status: ${assessment.status}`);
    if (assessment.urgencyLevel) doc.text(`Urgency: ${assessment.urgencyLevel}`);
    doc.moveDown();

    doc.fontSize(12).text("Reported symptoms", { underline: true });
    if (assessment.symptoms.length === 0) {
      doc.fontSize(10).text("None recorded individually — see intake below.");
    } else {
      assessment.symptoms.forEach((s) => {
        doc.fontSize(10).text(`• ${s.name}${s.severity ? ` (severity ${s.severity}/10)` : ""}`);
      });
    }
    doc.moveDown();

    doc.fontSize(12).text("Intake details", { underline: true });
    doc.fontSize(9).fillColor("#333333");
    Object.entries(assessment.intake as Record<string, unknown>).forEach(([key, value]) => {
      doc.text(`${key}: ${Array.isArray(value) ? value.join(", ") || "—" : String(value ?? "—")}`);
    });
    doc.moveDown();

    if (assessment.recommendation) {
      const rec = assessment.recommendation;
      doc.fillColor("#000000").fontSize(12).text("AI-assisted recommendation", { underline: true });
      doc.fontSize(10);
      doc.text(`Recommended department: ${rec.recommendedDept}`);
      doc.text(`Confidence score: ${(rec.confidenceScore * 100).toFixed(0)}%`);
      doc.moveDown(0.3);
      doc.text("Reasoning:", { continued: false });
      doc.fontSize(9).fillColor("#333333").text(rec.explanation);
      doc.moveDown();
    }

    if (assessment.clinicianNotes) {
      doc.fillColor("#000000").fontSize(12).text("Clinician notes", { underline: true });
      doc.fontSize(10).text(assessment.clinicianNotes);
      doc.moveDown();
    }

    doc
      .moveDown(2)
      .fontSize(8)
      .fillColor("#999999")
      .text(
        "This report is generated to assist clinical triage and does not constitute a medical " +
          "diagnosis. All recommendations must be reviewed and confirmed by a qualified healthcare " +
          "professional before acting on them.",
        { align: "left" }
      );

    doc.end();
  },
};
