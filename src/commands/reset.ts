import { Context, Markup } from "telegraf";
import { getUser, resetDayLog } from "../db";

export async function resetCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply(
      "לא מצאתי את הפרופיל שלך. אנא הירשם תחילה עם /התחל"
    );
    return;
  }

  const logCount = user.currentDayLog.length;

  if (logCount === 0) {
    await ctx.reply("📋 יומן היום כבר ריק — אין מה לאפס!");
    return;
  }

  await ctx.reply(
    `⚠️ *איפוס יומן היום*\n\nיש לך ${logCount} ארוחות רשומות היום.\nהאם אתה בטוח שרוצה למחוק את כל הרשומות?\n\n*פעולה זו לא ניתנת לביטול!*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ כן, אפס", "confirm_reset_yes"),
          Markup.button.callback("❌ לא, בטל", "confirm_reset_no"),
        ],
      ]),
    }
  );
}

export async function handleResetCallback(ctx: Context, data: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  if (data === "confirm_reset_yes") {
    resetDayLog(telegramId);
    await ctx.editMessageText(
      "✅ *היומן אופס בהצלחה!*\n\nבוא נתחיל מחדש — מה אכלת היום?",
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "confirm_reset_no" || data === "confirm_reset") {
    await ctx.editMessageText("❌ האיפוס בוטל. היומן שלך שמור.");
    return;
  }
}
