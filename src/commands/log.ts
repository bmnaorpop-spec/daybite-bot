import { Context, Markup } from "telegraf";
import { parseFoodLog } from "../claude";
import { appendMealLog, getUser, getMealLogsForDay, getToday } from "../db";
import {
  formatLoggedMeals,
  formatHighCalorieWarning,
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

  // Format and send response
  let formattedText = formatLoggedMeals(entries);

  // Append daily calorie summary line
  const updatedLog = getMealLogsForDay(telegramId, getToday());
  const totalCaloriesToday = updatedLog.reduce((sum, e) => sum + e.calories, 0);
  if (user.dietType === "caloric_balance" && user.calorieGoal) {
    const remaining = user.calorieGoal - totalCaloriesToday;
    if (remaining > 0) {
      formattedText += `\n\n📊 נשארו לך *${Math.round(remaining)} קק״ל* מתוך יעד ${user.calorieGoal} היום`;
    } else {
      formattedText += `\n\n⚠️ חרגת מהיעד היומי ב-*${Math.round(Math.abs(remaining))} קק״ל*`;
    }
  } else {
    formattedText += `\n\n📊 סה״כ היום: *${Math.round(totalCaloriesToday)} קק״ל*`;
  }

  await ctx.reply(formattedText, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 סיכום יומי", "show_summary"),
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

  // Ask how the user felt after eating (symptom tracking).
  // The loggedAt timestamp is embedded in the callback_data so the handler
  // doesn't rely on any in-memory state (survives bot restarts / PM2 reloads).
  const ts = entries[0].loggedAt;

  await ctx.reply(
    "🌡️ *איך הרגשת 1–2 שעות אחרי הארוחה?*\n_(ניתן לדלג — פשוט התעלם מהשאלה)_",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ רגיל",        `symptom_normal|${ts}`),
          Markup.button.callback("😮‍💨 נפיחות", `symptom_bloating|${ts}`),
        ],
        [
          Markup.button.callback("🔥 צרבת",        `symptom_heartburn|${ts}`),
          Markup.button.callback("😴 עייפות",      `symptom_fatigue|${ts}`),
        ],
        [Markup.button.callback("🔸 אחר",          `symptom_other|${ts}`)],
      ]),
    }
  );
}

export async function logCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    "📝 *תיעוד ארוחה*\n\nספר לי מה אכלת! לדוגמה:\n\"אכלתי בוקר שתי ביצים עם לחם ובצהריים שניצל עם אורז\"",
    { parse_mode: "Markdown" }
  );
}
