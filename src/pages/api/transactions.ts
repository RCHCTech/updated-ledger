import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

const INFLOW = new Set(["fill", "recover", "transfer_in"]);
const OUTFLOW = new Set(["charge", "transfer_out", "return", "reversal"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { serial, gasCode, transactionType, quantityKg, notes } = req.body ?? {};

      if (!serial || !gasCode || !transactionType || quantityKg == null) {
        return res
          .status(400)
          .json({ error: "Missing required fields: serial, gasCode, transactionType, quantityKg" });
      }
      if (!INFLOW.has(transactionType) && !OUTFLOW.has(transactionType)) {
        return res.status(400).json({ error: "Invalid transactionType" });
      }

      const absQty = Math.abs(Number(quantityKg));
      if (!Number.isFinite(absQty) || absQty <= 0) {
        return res.status(400).json({ error: "quantityKg must be a positive number" });
      }
      const signedQty = INFLOW.has(transactionType) ? absQty : -absQty;

      // Ensure Gas row (code unique, name required in your schema)
      const gas = await prisma.gas.upsert({
        where: { code: gasCode },
        update: {},
        create: { code: gasCode, name: gasCode },
      });

      // Ensure Bottle and connect it to this Gas
      const bottle = await prisma.bottle.upsert({
        where: { serial },
        update: { gas: { connect: { code: gas.code } } },
        create: {
          serial,
          gas: { connect: { code: gas.code } },
        },
      });

      // Create Transaction — use relations for bottle and gas
      const tx = await prisma.transaction.create({
        data: {
          bottle: { connect: { id: bottle.id } },
          gas: { connect: { code: gas.code } },
          transactionType,
          quantityKg: signedQty,
          notes: typeof notes === "string" ? notes : null,
          occurredAt: new Date(),
        },
        include: { gas: true },
      });

      return res.json({ ok: true, transaction: tx });
    } catch (e: any) {
      console.error("API error (POST /api/transactions):", e);
      return res.status(500).json({ error: e.message || "Server error" });
    }
  }

  if (req.method === "GET") {
    try {
      const all = await prisma.transaction.findMany({
        orderBy: { occurredAt: "desc" },
        include: { gas: true, bottle: { select: { serial: true } } },
      });
      return res.json(all);
    } catch (e: any) {
      console.error("API error (GET /api/transactions):", e);
      return res.status(500).json({ error: e.message || "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
