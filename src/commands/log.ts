import { Context, Markup } from "telegraf";
import { parseFoodLog } from "../claude";
import { appendMealLog, getUser } from "../db";
import {
  formatLoggedMeals,
  formatHighCalorieWarning,
} from "../utils/formatters";
import { MealEntry } from "../types";

// Maps telegramId → loggedAt timestamp of the last batch, so the symptom
// callback can find the right rows to update.
export const pendingSymptomTimestamp = new Map<number, string>();

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
  const formattedText = formatLoggedMeals(entries);

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

  // Ask how the user felt after eating (symptom tracking)
  const batchTimestamp = entries[0].loggedAt;
  pendingSymptomTimestamp.set(telegramId, batchTimestamp);

  await ctx.reply(
    "🌡️ *איך הרגשת 1–2 שעות אחרי הארוחה?*\n_(ניתן לדלג — פשוט התעלם מהשאלה)_",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ רגיל", "symptom_normal"),
          Markup.button.callback("😮‍💨 נפיחות", "symptom_bloating"),
        ],
        [
          Markup.button.callback("🔥 צרבת", "symptom_heartburn"),
          Markup.button.callback("😴 עייפות", "symptom_fatigue"),
        ],
        [Markup.button.callback("🔸 אחר", "symptom_other")],
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
