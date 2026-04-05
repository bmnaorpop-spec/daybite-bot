import { Context, Markup } from "telegraf";
import { getUser, getMealLogsForDay, getToday } from "../db";
import { generateMealPlan, generateRefinedPlan } from "../claude";

// Store the last generated plan per user for refinements
const lastPlanCache = new Map<number, string>();

export async function planCommand(ctx: Context): Promise<void> {
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

  if (todayLog.length === 0) {
    await ctx.reply(
      "🍽️ *תכנון המשך היום*\n\n" +
      "עוד לא תיעדת ארוחות היום.\n" +
      "שלח לי מה אכלת עד כה ואז אוכל לתכנן לך את המשך היום בצורה מדויקת!",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📝 תעד ארוחה", "prompt_log")],
        ]),
      }
    );
    return;
  }

  await ctx.sendChatAction("typing");

  let plan: string;
  try {
    plan = await generateMealPlan(user, todayLog);
  } catch (error) {
    console.error("Claude meal plan error:", error);
    await ctx.reply(
      "סליחה, נתקלתי בבעיה זמנית. נסה שוב בעוד רגע 🙏"
    );
    return;
  }

  lastPlanCache.set(telegramId, plan);

  await ctx.reply(
    `🍽️ *תוכנית ארוחות להמשך היום*\n\n${plan}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ שמור תוכנית", "save_plan"),
          Markup.button.callback("🔄 תכנן מחדש", "replan"),
        ],
        [Markup.button.callback("✏️ התאם אישית", "customize_plan")],
      ]),
    }
  );
}

export async function handlePlanRefinement(
  ctx: Context,
  refinement: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) return;

  const lastPlan = lastPlanCache.get(telegramId);
  if (!lastPlan) {
    await ctx.reply(
      "לא נמצאה תוכנית קודמת. אנא הפעל /תכנון תחילה."
    );
    return;
  }

  await ctx.sendChatAction("typing");

  let refinedPlan: string;
  try {
    refinedPlan = await generateRefinedPlan(refinement, lastPlan, user);
  } catch (error) {
    console.error("Claude refinement error:", error);
    await ctx.reply(
      "סליחה, נתקלתי בבעיה זמנית. נסה שוב בעוד רגע 🙏"
    );
    return;
  }

  lastPlanCache.set(telegramId, refinedPlan);

  await ctx.reply(
    `✏️ *תוכנית מעודכנת:*\n\n${refinedPlan}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ שמור תוכנית", "save_plan"),
          Markup.button.callback("🔄 תכנן מחדש", "replan"),
        ],
        [Markup.button.callback("✏️ התאם אישית", "customize_plan")],
      ]),
    }
  );
}

export { lastPlanCache };
