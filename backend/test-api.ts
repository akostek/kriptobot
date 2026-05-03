import { PrismaClient } from '@prisma/client';

const updateKeys = async () => {
  const prisma = new PrismaClient();
  await prisma.setting.update({
    where: { id: "1" },
    data: {
      binanceKey: "PIHLsuFsk4rKVYJKQmOE2WGJ7fzP9FWY7GVyInVixzHibsSObA5ikYQOwrHifMgn",
      binanceSecret: "hwVOJ6obXpGinbcu2T41Hle7mwBnUoUwVsI1GeM5uHEwHqdoF8epFcNfNsQFK98R"
    }
  });
  console.log("Keys updated!");
};

updateKeys();
