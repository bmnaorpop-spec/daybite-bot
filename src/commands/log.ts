import { Context, Markup } from "telegraf";
import { parseFoodLog } from "../claude";
import { appendMealLog, getUser, getMealLogsForDay, getToday } from "../db";
import {
  formatLoggedMeals,
  formatHighCalorieWarning,
  formatDailySummary,
} from "../utils/formatters";
import { MealEntry } from "../types";

export async function handleFoodLog(ctx: Context, userMessage: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply(
      "לא מצאתי את הפרופיל שלך. אנא הירשם תחילה עם /התחל"
    );
    return;
  }

  await ctx.sendChatAction("typing");

  let entries: MealEntry[];
  try {
    entries = await parseFoodLog(userMessage, user);
  } catch (error) {
    console.error("Claude food parse error:", error);
    await ctx.reply(
      "סליחה, נתקלתי בבעיה זמנית. נסה שוב בעוד רגע 🙏"
    );
    return;
  }

  if (!entries || entries.length === 0) {
    await ctx.reply(
      "לא הצלחתי להבין מה אכלת — תוכל לפרט קצת יותר? 🤔\n\n" +
      "לדוגמה: \"אכלתי בוקר שתי ביצים עם לחם ואחר הצהריים שניצל עם אורז\""
    );
    return;
  }

  // Check for unrealistic calorie estimates
  const highCalorieEntries = entries.filter((e) => e.calories > 3000);

  // Save all entries to DB
  for (const entry of entries) {
    appendMealLog(telegramId, entry);
  }

  // Send confirmation for just-logged entries
  const formattedText = formatLoggedMeals(entries);
  await ctx.reply(formattedText, { parse_mode: "Markdown" });

  // Send running daily summary as a separate message
  const updatedLog = getMealLogsForDay(telegramId, getToday());
  const dailySummaryText = formatDailySummary(user, updatedLog);
  await ctx.reply(dailySummaryText, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("🍽️ תכנן המשך יום", "show_plan"),
      ],
    ]),
  });

  // Flag high calorie entries
  for (const entry of highCalorieEntries) {
    await ctx.reply(formatHighCalorieWarning(entry), {
      parse_mode: "Markdown",
    });
  }
}

export async function logCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    "📝 *תיעוד ארוחה*\n\nספר לי מה אכלת! לדוגמה:\n\"אכלתי בוקר שתי ביצים עם לחם ובצהריים שניצל עם אורז\"",
    { parse_mode: "Markdown" }
  );
}
