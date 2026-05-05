const axios = require("axios");

// Get presence for multiple users
async function getPresence(userIds) {
  try {
    const res = await axios.post(
      "https://presence.roblox.com/v1/presence/users",
      { userIds }
    );

    return res.data.userPresences || [];
  } catch (err) {
    console.error("Presence fetch error:", err.message);
    return [];
  }
}

// Resolve placeId → game info
async function getGameInfo(placeId) {
  if (!placeId) return null;

  try {
    const res = await axios.get(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );

    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

async function getUsername(userId) {
  try {
    const res = await axios.get(
      `https://users.roblox.com/v1/users/${userId}`
    );

    return res.data?.name || null;
  } catch {
    return null;
  }
}

module.exports = { getPresence, getGameInfo, getUsername };