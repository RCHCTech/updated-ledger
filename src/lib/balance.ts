import { prisma } from "./prisma";

type TxForReduce = {
  quantityKg: unknown;
  transactionType: string;
  gas?: { code?: string } | null;
  occurredAt: Date;
  id?: string;
  notes?: string | null;
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

  // Opening balance may be null/undefined in some schemas — coerce safely
  const opening = Number((bottle as any).openingBalanceKg ?? 0);

  // ✅ Explicitly type the reducer to avoid implicit any
  const sum = (bottle.transactions as TxForReduce[]).reduce<number>(
    (acc: number, t: TxForReduce) => acc + Number(t.quantityKg),
    opening
  );

  // Work with gas code as a simple string for display
  let currentGasCode: string | null = bottle.gas?.code ?? null;

  if (!currentGasCode) {
    // First positive inflow gas if available
    const inflow = (bottle.transactions as TxForReduce[]).find(
      (t) =>
        ["fill", "recover", "transfer_in"].includes(t.transactionType) &&
        Number(t.quantityKg) > 0
    );
    currentGasCode =
      inflow?.gas?.code ??
      // Fallback: last transaction’s gas (if any)
      ((bottle.transactions[bottle.transactions.length - 1] as TxForReduce | undefined)?.gas?.code ??
        null);
  }

  return {
    serial: bottle.serial,
    status: "active",
    gas: currentGasCode,
    openingBalanceKg: opening,
    currentQuantityKg: sum,
    ledger: (bottle.transactions as TxForReduce[]).map((t) => ({
      id: (t as any).id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? currentGasCode,
      quantityKg: Number(t.quantityKg),
      notes: t.notes ?? null,
    })),
  };
}
