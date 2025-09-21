import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

// Explicit type for a transaction row
interface TxRow {
  id: string;
  occurredAt: Date;
  transactionType: string;
  quantityKg: number | string | null;
  notes: string | null;
  gas?: { code?: string } | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { serial } = req.query;

  if (!serial || typeof serial !== "string") {
    return res.status(400).json({ error: "Serial number is required" });
  }

  try {
    const bottle = await prisma.bottle.findUnique({
      where: { serial },
      include: {
        gas: true,
        transactions: {
          orderBy: { occurredAt: "asc" },
          include: { gas: true },
        },
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: "Bottle not found" });
    }

    // Cast the transactions to TxRow[] so map has the right type
    const txs: TxRow[] = bottle.transactions as unknown as TxRow[];

    const openingBalanceKg = Number((bottle as any).openingBalanceKg ?? 0);

    let currentQuantityKg = openingBalanceKg;
    for (const t of txs) {
      currentQuantityKg += Number(t.quantityKg ?? 0);
    }

    // ✅ map callback now knows t is TxRow, so no implicit any
    const ledger = txs.map((t: TxRow) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? bottle.gas?.code ?? null,
      quantityKg: Number(t.quantityKg ?? 0),
      notes: t.notes ?? null,
    }));

    return res.json({
      serial: bottle.serial,
      status: "active",
      gas: bottle.gas?.code ?? null,
      openingBalanceKg,
      currentQuantityKg,
      ledger,
    });
  } catch (e: any) {
    console.error("Error in bottles API:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
