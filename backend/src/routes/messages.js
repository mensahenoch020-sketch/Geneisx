const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { requireClientAuth, requireStaffAuth } = require("../middleware/auth");
const { logClientAction, logAction } = require("../lib/audit");
const asyncHandler = require("../lib/asyncHandler");

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many messages sent. Slow down a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

// ========== Client-facing: /api/me/messages ==========
// One flat thread per client — every message they've sent or received from
// staff, in order. There's no concept of multiple conversations on the
// client side; it's a single ongoing support thread.
const selfRouter = express.Router();
selfRouter.use(requireClientAuth);

// GET /api/me/messages — the client's full thread, oldest first. Marks any
// unread staff messages as read, since viewing the thread is what "read"
// means from the client's side.
selfRouter.get("/", asyncHandler(async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { clientId: req.client.id },
    orderBy: { createdAt: "asc" },
  });

  const unreadIds = messages.filter((m) => m.senderType === "STAFF" && !m.readByClient).map((m) => m.id);
  if (unreadIds.length > 0) {
    await prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { readByClient: true } });
  }

  res.json({ messages });
}));

// POST /api/me/messages — send a message to support.
selfRouter.post("/", sendLimiter, asyncHandler(async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message can't be empty" });

  const message = await prisma.message.create({
    data: {
      clientId: req.client.id,
      senderType: "CLIENT",
      senderClientId: req.client.id,
      body: parsed.data.body,
      readByClient: true, // they obviously "read" their own message
      readByStaff: false,
    },
  });

  await logClientAction({ clientId: req.client.id, action: "message.sent", targetId: message.id });

  res.status(201).json({ message });
}));

// ========== Staff-facing: /api/messages ==========
const staffRouter = express.Router();
staffRouter.use(requireStaffAuth);

// GET /api/messages/conversations — one row per client with any messages,
// most-recently-active first, plus their unread-by-staff count. This is the
// admin inbox list view.
staffRouter.get("/conversations", asyncHandler(async (req, res) => {
  const clients = await prisma.client.findMany({
    where: { messages: { some: {} } },
    select: {
      id: true,
      name: true,
      email: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { messages: { where: { senderType: "CLIENT", readByStaff: false } } },
      },
    },
  });

  const conversations = clients
    .map((c) => ({
      clientId: c.id,
      clientName: c.name,
      clientEmail: c.email,
      lastMessage: c.messages[0] || null,
      unreadCount: c._count.messages,
    }))
    .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));

  res.json({ conversations });
}));

// GET /api/messages/:clientId — full thread with one client. Marks any
// unread client messages as read by staff.
staffRouter.get("/:clientId", asyncHandler(async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.clientId } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  const messages = await prisma.message.findMany({
    where: { clientId: req.params.clientId },
    orderBy: { createdAt: "asc" },
  });

  const unreadIds = messages.filter((m) => m.senderType === "CLIENT" && !m.readByStaff).map((m) => m.id);
  if (unreadIds.length > 0) {
    await prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { readByStaff: true } });
  }

  res.json({ client: { id: client.id, name: client.name, email: client.email }, messages });
}));

// POST /api/messages/:clientId — staff reply to a specific client's thread.
staffRouter.post("/:clientId", asyncHandler(async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message can't be empty" });

  const client = await prisma.client.findUnique({ where: { id: req.params.clientId } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  const message = await prisma.message.create({
    data: {
      clientId: req.params.clientId,
      senderType: "STAFF",
      senderUserId: req.user.id,
      body: parsed.data.body,
      readByStaff: true, // staff obviously "read" their own message
      readByClient: false,
    },
  });

  await logAction({
    userId: req.user.id,
    action: "message.replied",
    targetId: message.id,
    clientId: req.params.clientId,
  });

  res.status(201).json({ message });
}));

module.exports = { selfRouter, staffRouter };
