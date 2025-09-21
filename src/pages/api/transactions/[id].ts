import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

const INFLOW = new Set(["fill", "recover", "transfer_in"]);
const OUTFLOW = new Set(["charge", "transfer_out", "return", "reversal"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  try {
    if (req.method === "GET") {
      const tx = await prisma.transaction.findUnique({
        where: { id },
        include: { gas: true, bottle: { select: { serial: true } } },
      });
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      return res.json(tx);
    }

    if (req.method === "DELETE") {
      const existing = await prisma.transaction.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Transaction not found" });

      await prisma.transaction.delete({ where: { id } });
      return res.json({ ok: true, message: `Transaction ${id} deleted` });
    }

    if (req.method === "PATCH") {
      const body = req.body ?? {};
      const existing = await prisma.transaction.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Transaction not found" });

      const nextType = (body.transactionType ?? existing.transactionType) as string;
      if (!INFLOW.has(nextType) && !OUTFLOW.has(nextType)) {
        return res.status(400).json({ error: "Invalid transactionType" });
      }

      const absQty =
        body.quantityKg !== undefined
          ? Math.abs(Number(body.quantityKg))
          : Math.abs(Number(existing.quantityKg));
      if (!Number.isFinite(absQty) || absQty <= 0) {
        return res.status(400).json({ error: "quantityKg must be positive" });
      }
      const signedQty = INFLOW.has(nextType) ? absQty : -absQty;

      // If gasCode provided, ensure Gas exists and connect both bottle and transaction
      let gasConnectData: { connect: { code: string } } | undefined = undefined;
      if (typeof body.gasCode === "string" && body.gasCode.trim().length > 0) {
        const gas = await prisma.gas.upsert({
          where: { code: body.gasCode },
          update: {},
          create: { code: body.gasCode, name: body.gasCode },
        });

        // Keep bottle aligned with the transaction gas (optional but consistent)
        await prisma.bottle.update({
          where: { id: existing.bottleId },
          data: { gas: { connect: { code: gas.code } } },
        });

        gasConnectData = { connect: { code: gas.code } };
      }

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          transactionType: nextType,
          quantityKg: signedQty,
          ...(gasConnectData ? { gas: gasConnectData } : {}), // only update relation if supplied
          notes: typeof body.notes === "string" ? body.notes : existing.notes,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : existing.occurredAt,
        },
        include: { gas: true },
      });

      return res.json({ ok: true, updated });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("API error ([id].ts):", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
