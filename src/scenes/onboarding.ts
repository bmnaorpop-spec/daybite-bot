import { Scenes, Markup } from "telegraf";
import { createUser, getToday } from "../db";
import { DietType, UserGoal, BotPersonality } from "../types";

interface OnboardingState {
  name?: string;
  dietType?: DietType;
  calorieGoal?: number;
  customDietRules?: string;
  goal?: UserGoal;
  botPersonality?: BotPersonality;
  customPersonality?: string;
  awaitingFollowUp?: "calorie_goal" | "eating_window" | "custom_rules" | "custom_personality";
}

export const onboardingScene = new Scenes.WizardScene<Scenes.WizardContext>(
  "onboarding",

  // Step 1: Ask for name
  async (ctx) => {
    await ctx.reply(
      `👋 *ברוך הבא ל-DayBite — הבוט התזונתי האישי שלך!*\n\n` +
      `אני כאן כדי לעזור לך לעקוב אחר התזונה שלך, לנתח מה אכלת ולתכנן ארוחות מותאמות אישית.\n\n` +
      `בוא נתחיל עם כמה שאלות קצרות כדי להכיר אותך 😊\n\n` +
      `*שאלה 1 מתוך 4:*\n` +
      `מה שמך? (כך אפנה אליך)`,
      { parse_mode: "Markdown" }
    );
    return ctx.wizard.next();
  },

  // Step 2: Get name, ask diet type
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("אנא שלח את שמך כטקסט.");
      return;
    }

    const name = ctx.message.text.trim();
    if (!name || name.length < 1) {
      await ctx.reply("אנא הכנס שם תקין.");
      return;
    }

    (ctx.session as any).onboarding = { name } as OnboardingState;

    await ctx.reply(
      `נעים להכיר, *${name}*! 🎉\n\n` +
      `*שאלה 2 מתוך 4:*\n` +
      `מה סוג הדיאטה שלך?`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("⚖️ מאזן קלורי", "diet_caloric_balance"),
            Markup.button.callback("🥑 קטו", "diet_keto"),
          ],
          [
            Markup.button.callback("⏰ צום לסירוגין", "diet_intermittent_fasting"),
            Markup.button.callback("🌱 צמחוני", "diet_plant_based"),
          ],
          [
            Markup.button.callback("💪 עתיר חלבון", "diet_high_protein"),
            Markup.button.callback("✏️ מותאם אישית", "diet_custom"),
          ],
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // Step 3: Handle diet selection + follow-up, then ask goal
  async (ctx) => {
    const session = (ctx.session as any).onboarding as OnboardingState;

    // Handle follow-up answers (calorie goal, eating window, custom rules)
    if (session?.awaitingFollowUp && ctx.message && "text" in ctx.message) {
      const text = ctx.message.text.trim();

      if (session.awaitingFollowUp === "calorie_goal") {
        const calories = parseInt(text, 10);
        if (isNaN(calories) || calories < 500 || calories > 10000) {
          await ctx.reply("אנא הכנס מספר קלוריות תקין (למשל: 2000)");
          return;
        }
        session.calorieGoal = calories;
      } else if (session.awaitingFollowUp === "eating_window") {
        session.customDietRules = text;
      } else if (session.awaitingFollowUp === "custom_rules") {
        session.customDietRules = text;
      }

      session.awaitingFollowUp = undefined;
      (ctx.session as any).onboarding = session;
      await askGoal(ctx);
      return ctx.wizard.next();
    }

    // Handle diet type callback
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply("אנא בחר סוג דיאטה מהרשימה.");
      return;
    }

    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    const dietMap: Record<string, DietType> = {
      diet_caloric_balance: "caloric_balance",
      diet_keto: "keto",
      diet_intermittent_fasting: "intermittent_fasting",
      diet_plant_based: "plant_based",
      diet_high_protein: "high_protein",
      diet_custom: "custom",
    };

    const dietType = dietMap[data];
    if (!dietType) {
      await ctx.reply("בחירה לא תקינה, אנא נסה שוב.");
      return;
    }

    session.dietType = dietType;
    (ctx.session as any).onboarding = session;

    // Handle follow-up questions
    if (dietType === "caloric_balance") {
      session.awaitingFollowUp = "calorie_goal";
      (ctx.session as any).onboarding = session;
      await ctx.reply(
        "מה יעד הקלוריות היומי שלך?\n(ברירת מחדל: 2000 קק״ל)",
        { parse_mode: "Markdown" }
      );
      return; // Stay on this step
    } else if (dietType === "intermittent_fasting") {
      session.awaitingFollowUp = "eating_window";
      (ctx.session as any).onboarding = session;
      await ctx.reply(
        "מה חלון האכילה שלך?\n(למשל: 12:00–20:00)",
        { parse_mode: "Markdown" }
      );
      return; // Stay on this step
    } else if (dietType === "custom") {
      session.awaitingFollowUp = "custom_rules";
      (ctx.session as any).onboarding = session;
      await ctx.reply("תאר את כללי הדיאטה שלך בחופשיות:");
      return; // Stay on this step
    }

    await askGoal(ctx);
    return ctx.wizard.next();
  },

  // Step 4: Handle goal, ask personality
  async (ctx) => {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply("אנא בחר מטרה מהרשימה.");
      return;
    }

    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    const goalMap: Record<string, UserGoal> = {
      goal_lose_weight: "lose_weight",
      goal_build_muscle: "build_muscle",
      goal_maintain_weight: "maintain_weight",
      goal_eat_healthier: "eat_healthier",
      goal_more_energy: "more_energy",
    };

    const goal = goalMap[data];
    if (!goal) {
      await ctx.reply("בחירה לא תקינה, אנא נסה שוב.");
      return;
    }

    const session = (ctx.session as any).onboarding as OnboardingState;
    session.goal = goal;
    (ctx.session as any).onboarding = session;

    await ctx.reply(
      `*שאלה 3 מתוך 4:*\n` +
      `איזה סגנון תקשורת מתאים לך?`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🤗 מאמן חברותי", "personality_friendly_coach")],
          [Markup.button.callback("📊 תזונאי מקצועי", "personality_strict_nutritionist")],
          [Markup.button.callback("😄 חבר מצחיק", "personality_funny_friend")],
          [Markup.button.callback("⚡ ישיר וקצר", "personality_no_nonsense")],
          [Markup.button.callback("✏️ מותאם אישית", "personality_custom")],
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // Step 5: Handle personality, show confirmation + save
  async (ctx) => {
    const session = (ctx.session as any).onboarding as OnboardingState;

    // Handle free-text custom personality follow-up
    if (session?.awaitingFollowUp === "custom_personality" && ctx.message && "text" in ctx.message) {
      const text = ctx.message.text.trim();
      if (!text) {
        await ctx.reply("אנא תאר את הסגנון הרצוי.");
        return;
      }
      session.customPersonality = text;
      session.awaitingFollowUp = undefined;
      (ctx.session as any).onboarding = session;
      await showConfirmation(ctx, session);
      return ctx.wizard.next();
    }

    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply("אנא בחר סגנון תקשורת מהרשימה.");
      return;
    }

    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    const personalityMap: Record<string, BotPersonality> = {
      personality_friendly_coach: "friendly_coach",
      personality_strict_nutritionist: "strict_nutritionist",
      personality_funny_friend: "funny_friend",
      personality_no_nonsense: "no_nonsense",
      personality_custom: "custom",
    };

    const personality = personalityMap[data];
    if (!personality) {
      await ctx.reply("בחירה לא תקינה, אנא נסה שוב.");
      return;
    }

    if (personality === "custom") {
      session.botPersonality = "custom";
      session.awaitingFollowUp = "custom_personality";
      (ctx.session as any).onboarding = session;
      await ctx.reply(
        "✏️ *סגנון מותאם אישית*\n\n" +
        "תאר בחופשיות איך תרצה שאדבר אליך.\n" +
        "לדוגמה: _\"מקצועי אבל עם הומור, תן לי נתונים מדויקים ואל תסביר יותר מדי\"_",
        { parse_mode: "Markdown" }
      );
      return; // Stay on this step
    }

    session.botPersonality = personality;
    (ctx.session as any).onboarding = session;
    await showConfirmation(ctx, session);
    return ctx.wizard.next();
  },

  // Final step: Handle confirmation
  async (ctx) => {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply("אנא לחץ על אחד מהכפתורים.");
      return;
    }

    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (data === "restart_onboarding") {
      (ctx.session as any).onboarding = {};
      await ctx.reply("בסדר! בוא נתחיל מחדש.");
      await ctx.scene.reenter();
      return;
    }

    if (data !== "confirm_onboarding") {
      return;
    }

    const session = (ctx.session as any).onboarding as OnboardingState;
    const telegramId = ctx.from?.id;

    if (!telegramId || !session.name || !session.dietType || !session.goal || !session.botPersonality) {
      await ctx.reply("משהו השתבש. אנא נסה שוב עם /התחל");
      return ctx.scene.leave();
    }

    const now = new Date().toISOString();
    const today = getToday();

    createUser({
      telegramId,
      name: session.name,
      dietType: session.dietType,
      calorieGoal: session.calorieGoal,
      customDietRules: session.customDietRules,
      goal: session.goal,
      botPersonality: session.botPersonality,
      customPersonality: session.customPersonality,
      currentDayLog: [],
      lastLogDate: today,
      createdAt: now,
    });

    await ctx.reply(
      `🎉 *ברוך הבא, ${session.name}!*\n\n` +
      `הפרופיל שלך נשמר בהצלחה!\n\n` +
      `*מה אתה יכול לעשות עכשיו:*\n` +
      `📝 שלח לי מה אכלת ואתעד את זה\n` +
      `📊 /סיכום — סיכום יומי\n` +
      `🍽️ /תכנון — תכנון המשך היום\n` +
      `⚙️ /הגדרות — עריכת פרופיל\n` +
      `❓ /עזרה — כל הפקודות\n\n` +
      `בוא נתחיל! מה אכלת היום? 🍽️`,
      { parse_mode: "Markdown" }
    );

    (ctx.session as any).onboarding = {};
    return ctx.scene.leave();
  }
);

async function showConfirmation(ctx: any, session: OnboardingState): Promise<void> {
  const dietLabels: Record<string, string> = {
    caloric_balance: "מאזן קלורי",
    keto: "קטו",
    intermittent_fasting: "צום לסירוגין",
    plant_based: "צמחוני",
    high_protein: "עתיר חלבון",
    custom: "מותאם אישית",
  };
  const goalLabels: Record<string, string> = {
    lose_weight: "לרדת במשקל",
    build_muscle: "לבנות שריר",
    maintain_weight: "לשמור על משקל",
    eat_healthier: "לאכול בריא יותר",
    more_energy: "יותר אנרגיה",
  };
  const personalityLabels: Record<string, string> = {
    friendly_coach: "מאמן חברותי 🤗",
    strict_nutritionist: "תזונאי מקצועי 📊",
    funny_friend: "חבר מצחיק 😄",
    no_nonsense: "ישיר וקצר ⚡",
    custom: `מותאם אישית ✏️`,
  };

  const personalityDisplay =
    session.botPersonality === "custom" && session.customPersonality
      ? `מותאם אישית ✏️ — _${session.customPersonality}_`
      : personalityLabels[session.botPersonality ?? ""] ?? "";

  const summaryText =
    `✅ *סיכום הפרופיל שלך:*\n\n` +
    `👤 *שם:* ${session.name}\n` +
    `🥗 *דיאטה:* ${dietLabels[session.dietType ?? ""]}` +
    (session.dietType === "caloric_balance" && session.calorieGoal
      ? ` (${session.calorieGoal} קק״ל)`
      : session.customDietRules
      ? ` — ${session.customDietRules}`
      : "") +
    `\n🎯 *מטרה:* ${goalLabels[session.goal ?? ""]}\n` +
    `💬 *סגנון:* ${personalityDisplay}\n\n` +
    `האם הכל נכון?`;

  await ctx.reply(summaryText, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ אישור — בוא נתחיל!", "confirm_onboarding"),
        Markup.button.callback("🔄 התחל מחדש", "restart_onboarding"),
      ],
    ]),
  });
}

async function askGoal(ctx: any): Promise<void> {
  await ctx.reply(
    `*שאלה 3 מתוך 4:*\n` +
    `מה המטרה הראשית שלך?`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📉 לרדת במשקל", "goal_lose_weight")],
        [Markup.button.callback("💪 לבנות שריר", "goal_build_muscle")],
        [Markup.button.callback("⚖️ לשמור על משקל", "goal_maintain_weight")],
        [Markup.button.callback("🥗 לאכול בריא יותר", "goal_eat_healthier")],
        [Markup.button.callback("⚡ יותר אנרגיה", "goal_more_energy")],
      ]),
    }
  );
}
