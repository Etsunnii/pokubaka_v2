import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanupOrders() {
  await prisma.order.deleteMany(); // Удаляем все записи в таблице Order
  console.log("Все записи из таблицы Order удалены.");
}

cleanupOrders()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
