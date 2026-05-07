const fs = require('fs');
const path = require('path');
const config = require('../config');
const Playlist = require('../models/Playlist');
const Asset = require('../models/Asset');
const Player = require('../models/Player');
const { isActiveNow } = require('./schedule.service');
const { log } = require('./log.service');

// Deploy alle aktiven Playlists für einen einzelnen Player
async function deployForPlayer(player, io) {
  if (!player) return { activePlaylists: 0, files: 0 };

  const now = new Date();

  // Alle Playlists die diesen Player als Ziel haben
  const playlists = await Playlist.find({ targetPlayers: player._id })
    .populate('assets.asset')
    .sort({ createdAt: 1 });

  const activePlaylists = [];
  const validFiles = new Set();

  for (const playlist of playlists) {
    if (!isActiveNow(playlist.schedule, now)) continue;

    const activeAssets = [];
    for (const entry of playlist.assets) {
      if (!entry.asset) continue;
      if (!isActiveNow(entry.asset.validity, now)) continue;
      activeAssets.push(entry);
      validFiles.add(entry.asset.filename);
    }

    if (activeAssets.length > 0) {
      activePlaylists.push({ ...playlist.toObject(), assets: activeAssets });
    }
  }

  // Dateien in player-spezifischen Ordner syncen
  const folderKey = player.cpuSerialNumber || player._id.toString();
  const syncPath = path.join(config.syncDir, folderKey);
  fs.mkdirSync(syncPath, { recursive: true });

  for (const filename of validFiles) {
    const src = path.join(config.mediaDir, filename);
    const dest = path.join(syncPath, filename);
    if (!fs.existsSync(src) || fs.existsSync(dest)) continue;
    try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); }
  }

  // Alte Dateien entfernen
  for (const file of fs.readdirSync(syncPath)) {
    if (!validFiles.has(file)) fs.unlinkSync(path.join(syncPath, file));
  }

  // Config an Player schicken
  if (io && player.socket && player.isConnected) {
    const configPayload = buildConfigPayload(activePlaylists, [...validFiles].map((f) => ({ filename: f })));
    configPayload.defaultScreen = player.defaultScreen || 'modern';
    io.to(player.socket).emit('config', configPayload);
  }

  await log('deploy', `Deployed ${activePlaylists.length} playlists, ${validFiles.size} files`, {
    player: player.name || player.cpuSerialNumber,
    playerId: player._id,
    details: {
      playlists: activePlaylists.map((p) => p.name),
      files: [...validFiles],
    },
  });

  return { activePlaylists: activePlaylists.length, files: validFiles.size };
}

// Deploy alle Player einer UserGroup
async function deployForUserGroup(userGroupId, io) {
  const players = await Player.find({ userGroups: userGroupId, isConnected: true });
  for (const player of players) {
    try {
      await deployForPlayer(player, io);
    } catch (err) {
      console.error(`Deploy error for player ${player.name || player.cpuSerialNumber}:`, err.message);
    }
  }
}

// Deploy anhand einer Liste von Player-IDs (z.B. vom Schedule)
async function deployPlayerIds(playerIds, io) {
  const players = await Player.find({ _id: { $in: playerIds }, isConnected: true });
  for (const player of players) {
    try {
      await deployForPlayer(player, io);
    } catch (err) {
      console.error(`Deploy error for player ${player.name || player.cpuSerialNumber}:`, err.message);
    }
  }
}

function buildConfigPayload(playlists, assets) {
  return {
    playlists: playlists.map((p) => ({
      name: p.name,
      settings: p.settings,
      assets: p.assets.map((a) => ({
        filename: a.asset.filename,
        duration: a.duration || a.asset.duration || 10,
        type: a.asset.type,
        option: a.option,
      })),
    })),
    assets: assets.map((a) => ({ filename: a.filename })),
  };
}

module.exports = { deployForPlayer, deployForUserGroup, deployPlayerIds, buildConfigPayload };
