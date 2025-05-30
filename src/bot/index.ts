import TelegramBot, { Message } from "node-telegram-bot-api"
import dotenv from "dotenv"
import { botMessageHandler } from "./message-handler"
dotenv.config()

let bot:TelegramBot|undefined = undefined
const token = process.env.BOT_TOKEN || ""

export async function botStart() {
  try {
    bot = new TelegramBot(token, {polling: true})
    if (!bot)
      throw new Error(`Failed to create bot instance`)
    bot.on('message', async(msg:Message) => await botMessageHandler(bot as TelegramBot, msg))
    bot.on('callback_query', async(callbackQuery:any) => {})
  } catch (error) {
    throw new Error(`Failed in starting bot! error = ${error}`)
  }
}