const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { getPresence, getGameInfo } = require("./roblox");
const config = require("./config");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let statusMessage = null;

// memory of last states
const lastStates = {};

// normalize state
function getState(presence) {
  if (!presence) return "offline";
  if (presence.userPresenceType === 2) return `game-${presence.placeId}`;
  if (presence.userPresenceType === 1) return "online";
  return "offline";
}

// build embed dashboard
async function buildEmbed(presences, mapping) {
  const embed = new EmbedBuilder()
    .setTitle("Roblox Activity Monitor")
    .setColor(0x00ff99)
    .setTimestamp();

  for (const discordId in mapping) {
    const robloxId = mapping[discordId];
    const presence = presences.find(p => p.userId === robloxId);

    let status = "Offline";

    if (presence?.userPresenceType === 1) {
      status = "Online (menu)";
    }

    if (presence?.userPresenceType === 2) {
      const game = await getGameInfo(presence.placeId);

      const name =
        game?.name ||
        presence.lastLocation ||
        "Unknown experience";

      status = `In game: ${name}`;
    }

    embed.addFields({
      name: `<@${discordId}>`,
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

  // 🔔 change detection alerts
  for (const discordId in config.trackedUsers) {
    const robloxId = config.trackedUsers[discordId];
    const presence = presences.find(p => p.userId === robloxId);

    const newState = getState(presence);
    const oldState = lastStates[robloxId];

    if (oldState && oldState !== newState) {
      let msg = `<@${discordId}> `;

      if (newState.startsWith("game-")) {
        const game = await getGameInfo(presence.placeId);
        msg += `joined **${game?.name || presence.lastLocation || "a game"}** 🟢`;
      } else if (newState === "online") {
        msg += `is now online 🟡`;
      } else {
        msg += `went offline ⚫`;
      }

      channel.send(msg);
    }

    lastStates[robloxId] = newState;
  }

  // 📊 update dashboard embed
  const embed = await buildEmbed(presences, config.trackedUsers);

  if (!statusMessage) {
    statusMessage = await channel.send({ embeds: [embed] });
  } else {
    await statusMessage.edit({ embeds: [embed] });
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await updateStatus();
  setInterval(updateStatus, config.updateInterval);
});

client.login(process.env.DISCORD_TOKEN);