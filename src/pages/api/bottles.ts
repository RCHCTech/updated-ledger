import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { serial } = req.query;
  if (!serial || typeof serial !== "string") {
    return res.status(400).json({ error: "Serial number is required" });
  }

  try {
    const bottle = await prisma.bottle.findUnique({
      where: { serial },
      include: {
        gas: true, // Gas relation on Bottle
        transactions: {
          orderBy: { occurredAt: "asc" },
          include: { gas: true }, // Gas relation on each Transaction
        },
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: "Bottle not found" });
    }

    const ledger = bottle.transactions.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? bottle.gas?.code ?? null,
      quantityKg: Number(t.quantityKg),
      notes: t.notes ?? null,               // 🔹 include notes
    }));

    const openingBalanceKg = 0; // adjust if you track explicit openings
    const currentQuantityKg =
      openingBalanceKg + ledger.reduce((sum, tx) => sum + Number(tx.quantityKg), 0);

    return res.json({
      serial: bottle.serial,
      status: "active",
      gas: bottle.gas?.code ?? null,
      openingBalanceKg: Number(openingBalanceKg),
      currentQuantityKg: Number(currentQuantityKg),
      ledger,
    });
  } catch (e: any) {
    console.error("Error in bottles API:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
