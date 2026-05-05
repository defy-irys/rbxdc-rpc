const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { getPresence, getGameInfo, getUsername } = require("./roblox");
const config = require("./config");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let statusMessage = null;

// state cache
const lastStates = {};

// simple caches (important for API efficiency)
const discordUserCache = {};
const robloxUserCache = {};

// normalize presence state
function getState(presence) {
  if (!presence) return "offline";
  if (presence.userPresenceType === 2) return `game-${presence.placeId}`;
  if (presence.userPresenceType === 1) return "online";
  return "offline";
}

// get Discord display name (cached)
async function getDiscordName(discordId) {
  if (discordUserCache[discordId]) return discordUserCache[discordId];

  try {
    const user = await client.users.fetch(discordId);
    const name = user.globalName || user.username;

    discordUserCache[discordId] = name;
    return name;
  } catch {
    return "Unknown User";
  }
}

// get Roblox username (cached)
async function getRobloxName(robloxId) {
  if (robloxUserCache[robloxId]) return robloxUserCache[robloxId];

  const name = await getUsername(robloxId);

  robloxUserCache[robloxId] = name;
  return name;
}

// build dashboard embed
async function buildEmbed(presences, mapping) {
  const embed = new EmbedBuilder()
    .setTitle("Roblox Activity Monitor")
    .setColor(0x00ff99)
    .setTimestamp();

  for (const discordId in mapping) {
    const robloxId = mapping[discordId];
    const presence = presences.find(p => p.userId === robloxId);

    const discordName = await getDiscordName(discordId);
    const robloxName = await getRobloxName(robloxId);

    let status = "Offline";

    if (presence?.userPresenceType === 1) {
      status = "Online (menu)";
    }

    if (presence?.userPresenceType === 2) {
      const game = await getGameInfo(presence.placeId);

      const gameName =
        game?.name ||
        presence.lastLocation ||
        "Unknown experience";

      status = `In game: ${gameName}`;
    }

    embed.addFields({
      name: `${discordName} (RBX: ${robloxName || "Unknown"})`,
      value: status,
      inline: false
    });
  }

  embed.setFooter({ text: "Auto-updated every 5 minutes" });

  return embed;
}

async function updateStatus() {
  const userIds = Object.values(config.trackedUsers);
  const presences = await getPresence(userIds);

  const channel = await client.channels.fetch(config.channelId);

  // 🔔 change alerts
  for (const discordId in config.trackedUsers) {
    const robloxId = config.trackedUsers[discordId];
    const presence = presences.find(p => p.userId === robloxId);

    const newState = getState(presence);
    const oldState = lastStates[robloxId];

    if (oldState && oldState !== newState) {
      const discordName = await getDiscordName(discordId);

      let msg = `${discordName} `;

      if (newState.startsWith("game-")) {
        const game = await getGameInfo(presence.placeId);
        msg += `joined **${game?.name || presence.lastLocation || "a game"}**`;
      } else if (newState === "online") {
        msg += `is now online`;
      } else {
        msg += `went offline`;
      }

      channel.send(msg);
    }

    lastStates[robloxId] = newState;
  }

  // 📊 dashboard update
  const embed = await buildEmbed(presences, config.trackedUsers);

  try {
    if (!statusMessage) {
      statusMessage = await channel.send({ embeds: [embed] });
    } else {
      await statusMessage.edit({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Failed to update embed:", err.message);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await updateStatus();
  setInterval(updateStatus, config.updateInterval);
});

client.login(process.env.DISCORD_TOKEN);