import * as cheerio from "cheerio";
import axios from "axios";
import { Telegraf } from "telegraf";
import { readFileSync, writeFileSync } from "fs";

const debugChat = -4257086130;

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
const delay = (interval) => {
  return new Promise((resolve) => setTimeout(resolve, interval));
};

const BOT_TOKEN = "6705332486:AAFgYyZDhS32UCbadP5OzPVG_bBfyVFKFho";
const bot = new Telegraf(BOT_TOKEN);

const sendDebug = async (message: string) => {
  await bot.telegram.sendMessage(debugChat, message);
};

const getChats = (): number[] => {
  const data = readFileSync("./chatsToSend.txt").toString();
  if (data.length === 0) return [];

  return JSON.parse(readFileSync("./chatsToSend.txt").toString());
};

const saveChat = (chatId: number) => {
  const chats = getChats();
  if (!chats.includes(chatId)) {
    writeFileSync("./chatsToSend.txt", JSON.stringify([...chats, chatId]));
  }
};

bot.on("message", (ctx) => {
  if (ctx.message.chat.id < 0) return;
  saveChat(ctx.message.chat.id);
  ctx.reply("you're added");
});

const getServerAccommodation = async () => {
  const accommodations = [];
  const data = (
    await axios.get(
      "https://www.finn.no/realestate/lettings/search.html?location=1.20003.20050&sort=PUBLISHED_DESC"
    )
  ).data;

  const $ = cheerio.load(data);
  const allAccommodations = $("article");

  for (let i = 0; i < allAccommodations.length; i++) {
    const element = allAccommodations.eq(i);
    const priceAndSizeMatch =
      '[class="col-span-2 mt-16 flex justify-between sm:mt-4 sm:block space-x-12 font-bold whitespace-nowrap"]';
    const addressMatch = '[class="text-14 text-gray-500"]';
    const accommodationDetails = element.find(priceAndSizeMatch).children();
    const imageElements = element.find("img");
    const idElementText = element.find("div[aria-owns]").attr("aria-owns");

    const title = element.find("h2").text();
    const size = accommodationDetails.eq(0).text();
    const price = accommodationDetails.eq(1).text();
    const address = element.find(addressMatch).text();
    const id = idElementText.slice(10);
    const images = [];

    for (let j = 0; j < imageElements.length; j++) {
      images.push(imageElements.eq(j).attr("src"));
    }

    accommodations.push({ id, title, size, price, address, images });
  }
  return accommodations;
};

const getNewAccommodations = async () => {
  const parsedAccommodations = readFileSync("./accommodations.txt").toString();

  let newAccommodations;
  try {
    newAccommodations = await getServerAccommodation();
  } catch (e) {
    await sendDebug(`Error occurred in getNewAccommodations: ${e.message}`);
    return [];
  }
  const oldAccommodations =
    parsedAccommodations.length === 0 ? [] : JSON.parse(parsedAccommodations);

  const toAdd = newAccommodations.filter(
    (newAcc) => !oldAccommodations.find((oldAcc) => newAcc.id === oldAcc.id)
  );

  if (toAdd.length !== 0) {
    writeFileSync("./accommodations.txt", JSON.stringify(newAccommodations));
  }

  return toAdd;
};

const sendNewAccommodations = async (newAccommodations) => {
  if (!newAccommodations.length) return;

  const chats = getChats();

  for (const chat of chats) {
    for (const acc of newAccommodations) {
      const mediaGroup = [];
      const text = `Name: ${acc.title}
size: ${acc.size}
price: ${acc.price}
address: ${acc.address}`;

      for (const image of acc.images) {
        mediaGroup.push({ type: "photo", media: image });
      }

      await bot.telegram.sendMediaGroup(chat, mediaGroup);
      await bot.telegram.sendMessage(chat, text);
    }
  }
};

const bootstrap = async () => {
  bot.launch();

  while (true) {
    const minimumInterval = 3 * 1000 * 60;
    const maximumInterval = 6 * 1000 * 60;
    const interval = randomIntFromInterval(minimumInterval, maximumInterval);

    const newAccommodations = await getNewAccommodations();
    await sendNewAccommodations(newAccommodations);
    await sendDebug(
      `New accommodations to send: ${JSON.stringify(newAccommodations)}`
    );

    await delay(interval);
  }
};

bootstrap();
