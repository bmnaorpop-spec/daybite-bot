import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });
import { Telegraf, Scenes, session } from "telegraf";
import { onboardingScene } from "./scenes/onboarding";
import { logCommand, handleFoodLog } from "./commands/log";
import { summaryCommand } from "./commands/summary";
import { planCommand, handlePlanRefinement } from "./commands/plan";
import {
  settingsCommand,
  handleSettingsCallback,
  handleSettingsTextInput,
  getEditingState,
} from "./commands/settings";
import { resetCommand, handleResetCallback } from "./commands/reset";
import { removeCommand, handleRemoveMealCallback } from "./commands/remove";
import { helpCommand } from "./commands/help";
import { closeDb, getUser, updateMealSymptomByLoggedAt } from "./db";
import { MealSymptom } from "./types";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

if (!ANTHROPIC_KEY) {
  console.error("ANTHROPIC_API_KEY is missing in .env");
  process.exit(1);
}

const bot = new Telegraf<Scenes.WizardContext>(BOT_TOKEN);

// Set up scenes
const stage = new Scenes.Stage<Scenes.WizardContext>([onboardingScene]);
bot.use(session());
bot.use(stage.middleware());

// Track users who are refining meal plans
const awaitingPlanRefinement = new Set<number>();

// ─── Commands ───────────────────────────────────────────────────────────────

// /start and /התחל
async function handleStart(ctx: Scenes.WizardContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    // New user — start onboarding
    await ctx.scene.enter("onboarding");
  } else {
    // Returning user — show main menu
    await ctx.reply(
      `👋 *ברוך הבא חזרה, ${user.name}!*\n\n` +
      `מה תרצה לעשות היום?\n\n` +
      `📝 שלח לי מה אכלת\n` +
      `📊 /סיכום — סיכום יומי\n` +
      `🍽️ /תכנון — תכנון המשך היום\n` +
      `⚙️ /הגדרות — הגדרות פרופיל\n` +
      `❓ /עזרה — כל הפקודות`,
      { parse_mode: "Markdown" }
    );
  }
}

bot.command("start", handleStart);
bot.command("התחל", handleStart);

// /log and /יומן
bot.command("log", async (ctx) => await logCommand(ctx));
bot.command("יומן", async (ctx) => await logCommand(ctx));

// /summary and /סיכום
bot.command("summary", async (ctx) => await summaryCommand(ctx));
bot.command("סיכום", async (ctx) => await summaryCommand(ctx));

// /plan and /תכנון
bot.command("plan", async (ctx) => await planCommand(ctx));
bot.command("תכנון", async (ctx) => await planCommand(ctx));

// /settings and /הגדרות
bot.command("settings", async (ctx) => await settingsCommand(ctx));
bot.command("הגדרות", async (ctx) => await settingsCommand(ctx));

// /reset and /איפוס
bot.command("reset", async (ctx) => await resetCommand(ctx));
bot.command("איפוס", async (ctx) => await resetCommand(ctx));

// /remove and /הסר
bot.command("remove", async (ctx) => await removeCommand(ctx));
bot.command("הסר", async (ctx) => await removeCommand(ctx));

// /help and /עזרה
bot.command("help", async (ctx) => await helpCommand(ctx));
bot.command("עזרה", async (ctx) => await helpCommand(ctx));

// ─── Callback Query Handlers ─────────────────────────────────────────────────

bot.action("show_summary", async (ctx) => {
  await ctx.answerCbQuery();
  await summaryCommand(ctx);
});

bot.action("show_plan", async (ctx) => {
  await ctx.answerCbQuery();
  await planCommand(ctx);
});

bot.action("prompt_log", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "📝 ספר לי מה אכלת היום! לדוגמה:\n\"אכלתי בוקר שתי ביצים עם לחם ובצהריים שניצל עם אורז\""
  );
});

bot.action("confirm_reset", async (ctx) => {
  await handleResetCallback(ctx, "confirm_reset");
});

bot.action("confirm_reset_yes", async (ctx) => {
  await handleResetCallback(ctx, "confirm_reset_yes");
});

bot.action("confirm_reset_no", async (ctx) => {
  await handleResetCallback(ctx, "confirm_reset_no");
});

bot.action("save_plan", async (ctx) => {
  await ctx.answerCbQuery("✅ התוכנית נשמרה!");
  await ctx.reply(
    "✅ *התוכנית נשמרה!*\n\nבהצלחה! אל תשכח לתעד מה שאתה אוכל 😊",
    { parse_mode: "Markdown" }
  );
});

bot.action("replan", async (ctx) => {
  await ctx.answerCbQuery();
  await planCommand(ctx);
});

// Remove meal callbacks
bot.action(/^remove_meal\|/, async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  const loggedAt = data.slice("remove_meal|".length);
  await handleRemoveMealCallback(ctx, loggedAt);
});

// Symptom tracking callbacks
const symptomKeyMap: Record<string, MealSymptom> = {
  symptom_normal: "רגיל",
  symptom_bloating: "נפיחות",
  symptom_heartburn: "צרבת",
  symptom_fatigue: "עייפות",
  symptom_other: "אחר",
};

bot.action(/^symptom_/, async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const data = (ctx.callbackQuery as any).data as string;
  // callback_data format: "symptom_<key>|<loggedAt timestamp>"
  const pipeIdx = data.indexOf("|");
  const key = pipeIdx !== -1 ? data.slice(0, pipeIdx) : data;
  const loggedAt = pipeIdx !== -1 ? data.slice(pipeIdx + 1) : "";

  const symptom = symptomKeyMap[key];
  if (!symptom || !loggedAt) return;

  updateMealSymptomByLoggedAt(telegramId, loggedAt, symptom);

  const emojiMap: Record<MealSymptom, string> = {
    "רגיל": "✅",
    "נפיחות": "😮‍💨",
    "צרבת": "🔥",
    "עייפות": "😴",
    "אחר": "🔸",
  };

  await ctx.answerCbQuery(`${emojiMap[symptom]} ${symptom} — נרשם!`);
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    `${emojiMap[symptom]} *תחושה לאחר הארוחה: ${symptom}*\n\nתודה! עם הזמן אוכל לזהות דפוסים בתגובות שלך לאוכל מסוים. 🔍`,
    { parse_mode: "Markdown" }
  );
});

bot.action("customize_plan", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();
  awaitingPlanRefinement.add(telegramId);
  await ctx.reply(
    "✏️ *התאמה אישית של התוכנית*\n\n" +
    "ספר לי מה תרצה לשנות, לדוגמה:\n" +
    "• \"אני לא אוהב דגים\"\n" +
    "• \"יש לי רק 10 דקות לבישול\"\n" +
    "• \"אין לי בצל בבית\"\n" +
    "• \"אני מעדיף אוכל ים תיכוני\"",
    { parse_mode: "Markdown" }
  );
});

// Settings callbacks
bot.action(/^settings_/, async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  await handleSettingsCallback(ctx, data);
});

bot.action(/^set_diet_/, async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  await handleSettingsCallback(ctx, data);
});

bot.action(/^set_goal_/, async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  await handleSettingsCallback(ctx, data);
});

bot.action(/^set_personality_/, async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  await handleSettingsCallback(ctx, data);
});

// ─── Free-Text Message Handler ───────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const text = ctx.message.text;

  // Skip if it's a command
  if (text.startsWith("/")) return;

  // Check if user exists
  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply(
      "👋 שלום! נראה שאתה משתמש חדש.\n\nאנא התחל עם /התחל כדי להירשם לבוט."
    );
    return;
  }

  // Check if user is in settings text-input mode
  const settingsState = getEditingState(telegramId);
  if (settingsState?.awaitingText) {
    const handled = await handleSettingsTextInput(ctx, text, telegramId);
    if (handled) return;
  }

  // Detect remove-meal intent
  const removeMealIntent = /הסר|מחק|תמחק|remove/i;
  if (removeMealIntent.test(text)) {
    await removeCommand(ctx);
    return;
  }

  // Check if user is refining a meal plan
  if (awaitingPlanRefinement.has(telegramId)) {
    awaitingPlanRefinement.delete(telegramId);
    await handlePlanRefinement(ctx, text);
    return;
  }

  // Default: treat as food log
  await handleFoodLog(ctx, text);
});

// ─── Error Handler ───────────────────────────────────────────────────────────

bot.catch((err: any, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

// ─── Startup ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("🤖 DayBite Bot מתחיל...");

  try {
    await bot.telegram.setMyCommands([
      { command: "start", description: "הרשמה / כניסה חוזרת" },
      { command: "log", description: "תיעוד אוכל" },
      { command: "summary", description: "סיכום יומי עם ערכים תזונתיים" },
      { command: "plan", description: "תכנון המשך היום" },
      { command: "settings", description: "עריכת הפרופיל שלי" },
      { command: "reset", description: "איפוס יומן היום" },
      { command: "help", description: "כל הפקודות" },
    ]);
    console.log("✅ פקודות הבוט עודכנו ב-BotFather");
  } catch (err) {
    console.warn("⚠️ לא הצלחתי לעדכן פקודות:", err);
  }

  // Graceful shutdown
  process.once("SIGINT", () => {
    console.log("\n🛑 מכבה את הבוט...");
    bot.stop("SIGINT");
    closeDb();
    console.log("✅ הבסיס נתונים נסגר בצורה תקינה.");
  });

  process.once("SIGTERM", () => {
    console.log("\n🛑 מכבה את הבוט...");
    bot.stop("SIGTERM");
    closeDb();
    console.log("✅ הבסיס נתונים נסגר בצורה תקינה.");
  });

  bot.launch();
  console.log("✅ DayBite Bot פועל! שלח /start בטלגרם כדי להתחיל.");
}

main().catch((err) => {
  console.error("שגיאה קריטית:", err);
  process.exit(1);
});
