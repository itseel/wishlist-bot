require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("🌐 Web server running");
});

/* =========================
   💾 STORAGE
========================= */

const wishlists = new Map();
const cooldowns = new Map();
const lastCategory = new Map();
const publicMessages = new Map();

if (fs.existsSync("wishlists.json")) {
  const raw = JSON.parse(fs.readFileSync("wishlists.json", "utf8"));
  for (const id in raw) wishlists.set(id, raw[id]);
}

setInterval(() => {
  fs.writeFileSync(
    "wishlists.json",
    JSON.stringify(Object.fromEntries(wishlists), null, 2)
  );
}, 10000);

/* =========================
   ⏱ COOLDOWN
========================= */

function canEdit(userId) {
  const last = cooldowns.get(userId) || 0;
  if (Date.now() - last < 10 * 60 * 1000) return false;
  cooldowns.set(userId, Date.now());
  return true;
}

/* =========================
   📜 SLASH COMMANDS
========================= */

const commands = [
  new SlashCommandBuilder().setName("wishlist").setDescription("Create wishlist"),
  new SlashCommandBuilder().setName("editwishlist").setDescription("Edit wishlist"),
  new SlashCommandBuilder().setName("mywishlist").setDescription("View wishlist"),
  new SlashCommandBuilder().setName("help").setDescription("Help"),
].map(c => c.toJSON());

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* =========================
   🎁 CATEGORIES
========================= */

const categories = {
  aura: {
    label: "🔥 Aura",
    items: [
      "Shadowpaw","Lushbloom","Overcharged","Toxburst","Lipsmash","Seraphic",
      "Chromaburst","Majesty","Supernova","Cosmic Whirl","Dancing Petals",
      "Abyssal Flow","Galactic Veil","Flame Spirit","Volt","Cold","Darkness",
      "Celestial Wings","Mystic Dust","Jade Essence","Charm","Bubbly",
      "Shardstorm","Fairy","Bat","Whispers","Webweaver","Malv0id","Danza","Frozen"
    ],
  },
  lipsticks: {
    label: "💄 Lipsticks",
    items: [
      "Stardust","Infected","Emberleaf","Mermaid","Cloudy","Golden Cobra",
      "Spiderlord","Omen","Blood Reaver","Eggrose","Starry","Arctic"
    ],
  },
  stomps: {
    label: "💥 Stomps",
    items: [
      "Crushcone","Solar Flare","Rainbow Drop","Acid Splash","Mwah Smash",
      "Solaris","Starlight","Dynasty Rift","Eternity Beam","Claw Crush",
      "Verdant Charm","Blazing Singularity","Carrot Missiles","Falling Leaves",
      "Spectral Bloom","Glimburst","Moonrise","Blossom Reap","Tentacle Quake",
      "Void Pulse","Infernal Eruption","Veil","Lovestrike","Charmstep",
      "Love Rise","Lovebolt","Glowing Heart","Abyss Impact","Celestial Shard",
      "Eggsplode","Storm Strike","Amour Bang","Slay Wave","Frosty Burst",
      "Falling Gifts","Snowfall","Blizzard Tornado","Aurora Gate","Lolliboom",
      "Divine Impact","Nebula","Energy Shock","Colorful Sparks","Soul Reaver",
      "Golden Serpent","Stellar","Frost","Blast","Ancient Symbols",
      "Happy Ghost","Void","Galactic Glow","Witch Portal","Toxic Blast",
      "Signal Crash","Spectral Ring","Sugar Storm","Candle Ritual",
      "Burning Jack","Soulburst","Spiderfall","Flores de Muertos","Goofy Squid"
    ],
  },
  knuckles: {
    label: "👊 Knuckles",
    items: [
      "Vampire","Ghost","Golden","Kitty","Cursed","Zap","Iced","Crystal",
      "Candy","Lumina","Elf","Sparkwing","Chrome","Princess","Voidskulls",
      "Dragon","Cupid","Ethereal","Rosethorn","Wavebreaker","Aether",
      "Cloudpaw","Cookie","Carrot","Moonveil","Sakura","Teddy Bear",
      "Inferno","Tentigrip","Astralis","Magma","Nightclaw","Tiki","Dune",
      "Cocosmash","Stellar Surge","Frosted Cream","Ribbon Blush","Batwing",
      "Fairylux","Fluffy Puppy","Gloop","Exalted","Fatal Kiss",
      "Prismatic Core","Imperial","Starfall","Ancient Skull",
      "Inferno Pumpkin","Forgotten Pharoah","Enchanted Spell",
      "Skeletal Reaper","Corrupt Pulse","Candy Spikes","Celestial Comet",
      "La Rosa","Gobble","Frostbite","Deerlight","Gingerbread Crunch"
    ],
  },
  styles: {
    label: "🕺 Styles",
    items: ["Karate","Werewolf","Princess","Zombie","Icebreaker","Witch"],
  },
};

/* =========================
   🧩 UI BUILDERS
========================= */

function categoryMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("category")
      .setPlaceholder("🎁 Choose a category")
      .addOptions(
        Object.entries(categories).map(([k, c]) => ({
          label: c.label,
          value: k,
        }))
      )
  );
}

function controlButtons(disabled = false, showBack = false) {
  const row = new ActionRowBuilder();

  if (showBack) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("back")
        .setLabel("⬅ Back")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }

  row.addComponents(
    new ButtonBuilder().setCustomId("add").setLabel("➕ Add").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("remove").setLabel("➖ Remove").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("search").setLabel("🔍 Search").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("confirm").setLabel("✅ Confirm").setStyle(ButtonStyle.Success).setDisabled(disabled)
  );

  return row;
}

function wishlistEmbed(userId) {
  const data = wishlists.get(userId) || {};
  const embed = new EmbedBuilder()
    .setTitle("🎁 Wishlist")
    .setColor(0xff66cc);

  if (!Object.keys(data).length) {
    embed.setDescription("No items yet.");
    return embed;
  }

  for (const cat in data) {
    embed.addFields({
      name: categories[cat].label,
      value: data[cat].map(i => `• ${i}`).join("\n"),
    });
  }

  return embed;
}

function removeMenu(userId) {
  const data = wishlists.get(userId);
  if (!data) return null;

  const options = [];
  for (const cat in data) {
    data[cat].forEach(item => {
      options.push({
        label: item,
        value: `${cat}||${item}`,
      });
    });
  }

  if (!options.length) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("remove_items")
      .setPlaceholder("Select items to remove")
      .setMinValues(1)
      .setMaxValues(Math.min(25, options.length))
      .addOptions(options.slice(0, 25))
  );
}

/* =========================
   🤖 INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {
  const userId = interaction.user.id;
  if (!wishlists.has(userId)) wishlists.set(userId, {});

  /* SLASH COMMANDS */
  if (interaction.isChatInputCommand()) {
    if (["wishlist","editwishlist"].includes(interaction.commandName)) {
      if (!canEdit(userId))
        return interaction.reply({ content: "⏱ Edit cooldown active.", ephemeral: true });

      return interaction.reply({
        content: "🎁 Choose a category",
        components: [categoryMenu()],
        ephemeral: true,
      });
    }

    if (interaction.commandName === "mywishlist") {
      return interaction.reply({
        embeds: [wishlistEmbed(userId)],
        components: [controlButtons()],
        ephemeral: true,
      });
    }

    if (interaction.commandName === "help") {
      return interaction.reply({
        content:
          "`/wishlist` create\n" +
          "`/editwishlist` edit\n" +
          "`/mywishlist` view",
        ephemeral: true,
      });
    }
  }

  /* CATEGORY SELECT */
  if (interaction.isStringSelectMenu() && interaction.customId === "category") {
    const cat = interaction.values[0];
    lastCategory.set(userId, cat);

    return interaction.update({
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`items_${cat}`)
            .setPlaceholder("Select items")
            .setMinValues(1)
            .setMaxValues(Math.min(25, categories[cat].items.length))
            .addOptions(categories[cat].items.slice(0, 25).map(i => ({ label: i, value: i })))
        ),
        controlButtons(false, true),
      ],
    });
  }

  /* ADD ITEMS */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("items_")) {
    const cat = interaction.customId.split("_")[1];
    const data = wishlists.get(userId);
    if (!data[cat]) data[cat] = [];

    interaction.values.forEach(i => {
      if (!data[cat].includes(i)) data[cat].push(i);
    });

    return interaction.update({
      embeds: [wishlistEmbed(userId)],
      components: [controlButtons(false, true)],
    });
  }

  /* SEARCH */
  if (interaction.isButton() && interaction.customId === "search") {
    const modal = new ModalBuilder()
      .setCustomId("search_modal")
      .setTitle("🔍 Search Items")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("query")
            .setLabel("Search in category")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "search_modal") {
    const cat = lastCategory.get(userId);
    const q = interaction.fields.getTextInputValue("query").toLowerCase();

    const matches = categories[cat].items.filter(i =>
      i.toLowerCase().includes(q)
    );

    if (!matches.length)
      return interaction.reply({ content: "❌ No matches.", ephemeral: true });

    return interaction.reply({
      content: `🔍 Results in ${categories[cat].label}`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`items_${cat}`)
            .setPlaceholder("Select items")
            .setMinValues(1)
            .setMaxValues(Math.min(25, matches.length))
            .addOptions(matches.slice(0, 25).map(i => ({ label: i, value: i })))
        ),
        controlButtons(false, true),
      ],
      ephemeral: true,
    });
  }

  /* REMOVE */
  if (interaction.isButton() && interaction.customId === "remove") {
    const menu = removeMenu(userId);
    if (!menu)
      return interaction.reply({ content: "❌ Nothing to remove.", ephemeral: true });

    return interaction.update({
      embeds: [wishlistEmbed(userId)],
      components: [menu, controlButtons(false, true)],
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "remove_items") {
    const data = wishlists.get(userId);

    interaction.values.forEach(v => {
      const [cat, item] = v.split("||");
      data[cat] = data[cat].filter(i => i !== item);
      if (!data[cat].length) delete data[cat];
    });

    return interaction.update({
      embeds: [wishlistEmbed(userId)],
      components: [controlButtons(false, true)],
    });
  }

  /* BACK */
  if (interaction.isButton() && interaction.customId === "back") {
    return interaction.update({
      content: "🎁 Choose a category",
      embeds: [],
      components: [categoryMenu()],
    });
  }

  /* CONFIRM */
  if (interaction.isButton() && interaction.customId === "confirm") {
    const old = publicMessages.get(userId);
    if (old) {
      try {
        const m = await interaction.channel.messages.fetch(old);
        await m.delete();
      } catch {}
    }

    const msg = await interaction.channel.send({
      content: `<@${userId}> wishlist!`,
      embeds: [wishlistEmbed(userId)],
    });

    publicMessages.set(userId, msg.id);

    return interaction.update({
      content: "✅ Wishlist saved!",
      embeds: [wishlistEmbed(userId)],
      components: [controlButtons(true)],
    });
  }

  /* ADD MORE */
  if (interaction.isButton() && interaction.customId === "add") {
    return interaction.update({
      content: "🎁 Choose a category",
      components: [categoryMenu()],
    });
  }
});

client.login(process.env.TOKEN);
