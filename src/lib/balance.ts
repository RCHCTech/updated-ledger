import { prisma } from "./prisma";

type Tx = {
  id: string;
  transactionType: string;
  quantityKg: number | string | null;
  occurredAt: Date;
  notes: string | null;
  gas?: { code?: string } | null;
};

export async function getBottleStateBySerial(serial: string) {
  const bottle = await prisma.bottle.findUnique({
    where: { serial },
    include: {
      transactions: {
        orderBy: { occurredAt: "asc" },
        include: { gas: true },
      },
      gas: true,
    },
  });

  if (!bottle) return null;

  const opening = Number((bottle as any).openingBalanceKg ?? 0);

  const txs = bottle.transactions as unknown as Tx[];

  // ✅ Explicitly typed reducer (no implicit any)
  const sum = txs.reduce<number>(
    (acc: number, t: Tx) => acc + Number(t.quantityKg ?? 0),
    opening
  );

  // Determine a gas code to display
  let currentGasCode: string | null = bottle.gas?.code ?? null;
  if (!currentGasCode) {
    const inflow = txs.find(
      (t) =>
        ["fill", "recover", "transfer_in"].includes(t.transactionType) &&
        Number(t.quantityKg ?? 0) > 0
    );
    currentGasCode =
      inflow?.gas?.code ??
      (txs.length ? txs[txs.length - 1].gas?.code ?? null : null);
  }

  return {
    serial: bottle.serial,
    status: "active",
    gas: currentGasCode,
    openingBalanceKg: opening,
    currentQuantityKg: sum,
    ledger: txs.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? currentGasCode,
      quantityKg: Number(t.quantityKg ?? 0),
      notes: t.notes ?? null,
    })),
  };
}
