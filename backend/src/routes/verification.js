const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { requireClientAuth, requireStaffAuth } = require("../middleware/auth");
const { logClientAction, logAction } = require("../lib/audit");
const { getDocumentTypesForCountry, COUNTRIES } = require("../lib/verificationDocTypes");

// 8MB cap — enough for a phone photo of an ID, not so large it invites abuse
// given documents are stored directly in Postgres (see DEPLOYMENT.md).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("File must be a JPEG, PNG, WEBP, or PDF"));
    }
    cb(null, true);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many upload attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== Client-facing: /api/me/verification ==========
const selfRouter = express.Router();
selfRouter.use(requireClientAuth);

// GET /api/me/verification — current status + reference data for the upload form
selfRouter.get("/", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    select: {
      verificationStatus: true,
      verificationDocuments: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { status: true, submittedAt: true, reviewNote: true, country: true, documentType: true },
      },
    },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  res.json({
    status: client.verificationStatus,
    latestSubmission: client.verificationDocuments[0] || null,
    countries: COUNTRIES,
  });
});

// GET /api/me/verification/document-types?country=US
selfRouter.get("/document-types", (req, res) => {
  const country = String(req.query.country || "").toUpperCase();
  res.json({ documentTypes: getDocumentTypesForCountry(country) });
});

const uploadSchema = z.object({
  country: z.string().min(2).max(10),
  documentType: z.string().min(1),
});

// POST /api/me/verification — submit a document. Always creates a new
// submission (never overwrites a prior one) so there's a full history if a
// client is rejected and resubmits — staff can see what changed.
// Does not block or gate anything else in the app; this only updates status.
selfRouter.post("/", uploadLimiter, upload.single("document"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No document uploaded" });

  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const client = await prisma.client.findUnique({ where: { id: req.client.id } });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const [, document] = await prisma.$transaction([
    prisma.client.update({
      where: { id: client.id },
      data: { verificationStatus: "PENDING" },
    }),
    prisma.verificationDocument.create({
      data: {
        clientId: client.id,
        country: parsed.data.country.toUpperCase(),
        documentType: parsed.data.documentType,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileData: req.file.buffer,
        fileSizeBytes: req.file.size,
        status: "PENDING",
      },
    }),
  ]);

  await logClientAction({
    clientId: client.id,
    action: "verification.submitted",
    targetId: document.id,
    detail: `${parsed.data.country} / ${parsed.data.documentType}`,
  });

  res.status(201).json({ status: "PENDING", submittedAt: document.submittedAt });
});

// ========== Staff-facing: /api/verification ==========
const staffRouter = express.Router();
staffRouter.use(requireStaffAuth);

// GET /api/verification/queue — all pending submissions, oldest first
staffRouter.get("/queue", async (req, res) => {
  const documents = await prisma.verificationDocument.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  res.json(
    documents.map((d) => ({
      id: d.id,
      client: d.client,
      country: d.country,
      documentType: d.documentType,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      submittedAt: d.submittedAt,
    }))
  );
});

// GET /api/verification/:id/file — the actual document image/PDF, streamed
// back for staff to view inline. Never exposed to any client-facing route.
staffRouter.get("/:id/file", async (req, res) => {
  const document = await prisma.verificationDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Document not found" });

  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${document.fileName}"`);
  res.send(Buffer.from(document.fileData));
});

const reviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

// POST /api/verification/:id/review — staff approves or rejects a submission.
// Updates both the document's own status and the client's overall
// verificationStatus together, atomically.
staffRouter.post("/:id/review", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const document = await prisma.verificationDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Document not found" });
  if (document.status !== "PENDING") {
    return res.status(409).json({ error: "This document has already been reviewed" });
  }

  const newStatus = parsed.data.approve ? "VERIFIED" : "REJECTED";
  const reviewedAt = new Date();

  await prisma.$transaction([
    prisma.verificationDocument.update({
      where: { id: document.id },
      data: { status: newStatus, reviewedBy: req.user.id, reviewedAt, reviewNote: parsed.data.note || null },
    }),
    prisma.client.update({
      where: { id: document.clientId },
      data: { verificationStatus: newStatus },
    }),
  ]);

  await logAction({
    userId: req.user.id,
    action: newStatus === "VERIFIED" ? "verification.approved" : "verification.rejected",
    targetId: document.id,
    detail: parsed.data.note || undefined,
    clientId: document.clientId,
  });

  res.json({ status: newStatus });
});

module.exports = { selfRouter, staffRouter };
