import { Context, Markup } from "telegraf";
import { getUser, getMealLogsForDay, getToday } from "../db";
import { formatDailySummary } from "../utils/formatters";

export async function summaryCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply(
      "לא מצאתי את הפרופיל שלך. אנא הירשם תחילה עם /התחל"
    );
    return;
  }

  const today = getToday();
  const todayLog = getMealLogsForDay(telegramId, today);
  const summaryText = formatDailySummary(user, todayLog);

  const keyboard = todayLog.length > 0
    ? Markup.inlineKeyboard([
        [
          Markup.button.callback("🍽️ תכנן המשך יום", "show_plan"),
          Markup.button.callback("🔄 איפוס יומן", "confirm_reset"),
        ],
      ])
    : Markup.inlineKeyboard([
        [Markup.button.callback("📝 תעד ארוחה", "prompt_log")],
      ]);

  await ctx.reply(summaryText, {
    parse_mode: "Markdown",
    ...keyboard,
  });
}
