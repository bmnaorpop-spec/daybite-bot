import { Context } from "telegraf";
import { formatHelpMessage } from "../utils/formatters";

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(formatHelpMessage(), { parse_mode: "Markdown" });
}
