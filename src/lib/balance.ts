import { prisma } from "./prisma";

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

  // Explicitly type the reducer
  const sum = bottle.transactions.reduce(
    (acc: number, t: { quantityKg: any }) => acc + Number(t.quantityKg),
    Number(bottle.openingBalanceKg)
  );

  // Infer gas
  let currentGas = bottle.gas;
  if (!currentGas) {
    const inflow = bottle.transactions.find(
      (t) =>
        ["fill", "recover", "transfer_in"].includes(t.transactionType) &&
        Number(t.quantityKg) > 0
    );
    if (inflow?.gas) {
      currentGas = inflow.gas;
    } else if (bottle.transactions.length > 0) {
      const lastTx = bottle.transactions[bottle.transactions.length - 1];
      if (lastTx.gas) currentGas = lastTx.gas;
    }
  }

  return {
    ...bottle,
    currentQuantityKg: sum,
    gas: currentGas,
  };
}
