import { Context, Markup } from "telegraf";
import { getUser, getMealLogsForDay, removeMealByLoggedAt, getToday } from "../db";

const timeEmoji: Record<string, string> = {
  "בוקר": "🌅",
  "צהריים": "☀️",
  "ערב": "🌙",
  "נשנוש": "🍎",
};

export async function removeCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply("לא מצאתי את הפרופיל שלך. אנא הירשם תחילה עם /התחל");
    return;
  }

  const todayLog = getMealLogsForDay(telegramId, getToday());

  if (todayLog.length === 0) {
    await ctx.reply("🗑️ לא נמצאו ארוחות להסרה היום.");
    return;
  }

  const buttons = todayLog.map((entry) => {
    const emoji = timeEmoji[entry.timeOfDay] || "🍽️";
    const label = `${emoji} ${entry.timeOfDay} — ${entry.description} (${Math.round(entry.calories)} קק״ל)`;
    return [Markup.button.callback(`🗑️ הסר: ${label}`, `remove_meal|${entry.loggedAt}`)];
  });

  await ctx.reply(
    `🗑️ *הסרת ארוחה*\n\nאיזו ארוחה תרצה להסיר מהיומן?`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    }
  );
}

export async function handleRemoveMealCallback(ctx: Context, loggedAt: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const user = getUser(telegramId);
  if (!user) return;

  const todayLog = getMealLogsForDay(telegramId, getToday());
  const meal = todayLog.find((e) => e.loggedAt === loggedAt);

  if (!meal) {
    await ctx.editMessageText("⚠️ הארוחה לא נמצאה — ייתכן שכבר הוסרה.");
    return;
  }

  removeMealByLoggedAt(telegramId, loggedAt);

  const remaining = todayLog.filter((e) => e.loggedAt !== loggedAt);
  const totalCaloriesLeft = remaining.reduce((sum, e) => sum + e.calories, 0);

  const emoji = timeEmoji[meal.timeOfDay] || "🍽️";
  let confirmText =
    `✅ *הוסרה ארוחת ${meal.timeOfDay}:* ${meal.description}\n\n` +
    `${emoji} סה״כ קלוריות שנשארו היום: *${Math.round(totalCaloriesLeft)} קק״ל*`;

  if (user.dietType === "caloric_balance" && user.calorieGoal) {
    const stillLeft = user.calorieGoal - totalCaloriesLeft;
    if (stillLeft > 0) {
      confirmText += `\n📊 נותרו לך *${Math.round(stillLeft)} קק״ל* מתוך יעד ${user.calorieGoal} קק״ל`;
    } else {
      confirmText += `\n⚠️ חרגת מהיעד ב-${Math.round(Math.abs(stillLeft))} קק״ל`;
    }
  }

  await ctx.editMessageText(confirmText, { parse_mode: "Markdown" });
}
