import { prisma } from "./prisma";

type Tx = {
  id: string;
  transactionType: string;
  quantityKg: number | string | null;
  occurredAt: Date;
  notes: string | null;
  gas?: { code?: string } | null;
};

type BottleWithTx = {
  serial: string;
  openingBalanceKg?: number | string | null;
  gas?: { code?: string } | null;
  transactions: Tx[];
};

export async function getBottleStateBySerial(serial: string) {
  const bottleRaw = await prisma.bottle.findUnique({
    where: { serial },
    include: {
      transactions: {
        orderBy: { occurredAt: "asc" },
        include: { gas: true },
      },
      gas: true,
    },
  });

  if (!bottleRaw) return null;

  const bottle = bottleRaw as unknown as BottleWithTx;

  // Opening balance (safely coerced)
  const opening = Number(bottle.openingBalanceKg ?? 0);

  // ✅ No reduce -> no implicit any
  let currentQuantityKg = opening;
  for (const t of bottle.transactions) {
    currentQuantityKg += Number(t.quantityKg ?? 0);
  }

  // Decide which gas code to show
  let currentGasCode: string | null = bottle.gas?.code ?? null;
  if (!currentGasCode) {
    // First positive inflow gas
    const inflow = bottle.transactions.find(
      (t) =>
        ["fill", "recover", "transfer_in"].includes(t.transactionType) &&
        Number(t.quantityKg ?? 0) > 0
    );
    if (inflow?.gas?.code) currentGasCode = inflow.gas.code;
    else if (bottle.transactions.length) {
      const last = bottle.transactions[bottle.transactions.length - 1];
      currentGasCode = last.gas?.code ?? null;
    }
  }

  // Shape the response the UI expects
  return {
    serial: bottle.serial,
    status: "active",
    gas: currentGasCode,
    openingBalanceKg: opening,
    currentQuantityKg,
    ledger: bottle.transactions.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? currentGasCode,
      quantityKg: Number(t.quantityKg ?? 0),
      notes: t.notes ?? null,
    })),
  };
}
