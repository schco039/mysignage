const fs = require('fs');
const path = require('path');
const config = require('../config');
const Playlist = require('../models/Playlist');
const Asset = require('../models/Asset');
const DisplayGroup = require('../models/DisplayGroup');
const Player = require('../models/Player');
const { isActiveNow } = require('./schedule.service');
const { log } = require('./log.service');

async function deployDisplayGroup(displayGroupId, io, playerIds = null) {
  const displayGroup = await DisplayGroup.findById(displayGroupId);
  if (!displayGroup) throw new Error('DisplayGroup not found');

  const now = new Date();

  // 1. Get all playlists for this display group, sorted by creation date
  const playlists = await Playlist.find({ displayGroup: displayGroupId })
    .populate('assets.asset')
    .sort({ createdAt: 1 });

  // 2. Filter active playlists and their valid assets
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
      activePlaylists.push({
        ...playlist.toObject(),
        assets: activeAssets,
      });
    }
  }

  // 3. Sync files to sync_folders/<groupName>/
  const syncPath = path.join(config.syncDir, displayGroup.name);
  fs.mkdirSync(syncPath, { recursive: true });

  // Link/copy valid files
  for (const filename of validFiles) {
    const src = path.join(config.mediaDir, filename);
    const dest = path.join(syncPath, filename);

    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest)) continue;

    try {
      fs.linkSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
    }
  }

  // Remove files no longer in the valid set
  const existingFiles = fs.readdirSync(syncPath);
  for (const file of existingFiles) {
    if (!validFiles.has(file)) {
      fs.unlinkSync(path.join(syncPath, file));
    }
  }

  // 4. Build deployed assets list
  const deployedAssets = [];
  for (const filename of validFiles) {
    const asset = await Asset.findOne({ filename });
    if (asset) {
      deployedAssets.push({ asset: asset._id, filename });
    }
  }

  // 5. Update display group
  displayGroup.deployedPlaylists = activePlaylists.map((p) => p._id);
  displayGroup.deployedAssets = deployedAssets;
  displayGroup.lastDeployed = now;
  await displayGroup.save();

  // 6. Notify connected players (optionally filtered by playerIds or playlist targetPlayers)
  if (io) {
    // Collect all target player IDs from playlists that have targetPlayers
    let targetPlayerIds = playerIds ? [...playerIds] : null;

    // If no explicit playerIds, check if playlists have targetPlayers
    if (!targetPlayerIds) {
      const playlistTargets = activePlaylists
        .filter((p) => p.targetPlayers && p.targetPlayers.length > 0)
        .flatMap((p) => p.targetPlayers.map((tp) => tp.toString()));
      if (playlistTargets.length > 0) {
        targetPlayerIds = [...new Set(playlistTargets)];
      }
    }

    const query = {
      'displayGroup._id': displayGroupId,
      isConnected: true,
    };
    if (targetPlayerIds && targetPlayerIds.length > 0) {
      query._id = { $in: targetPlayerIds };
    }
    const players = await Player.find(query);

    const configPayload = buildConfigPayload(displayGroup, activePlaylists, deployedAssets);

    for (const player of players) {
      if (player.socket) {
        io.to(player.socket).emit('config', configPayload);
      }
    }
  }

  await log('deploy', `Deployed ${activePlaylists.length} playlists, ${validFiles.size} files`, {
    displayGroup: displayGroup.name,
    details: {
      playlists: activePlaylists.map((p) => p.name),
      files: [...validFiles],
    },
  });

  return { activePlaylists: activePlaylists.length, files: validFiles.size };
}

function buildConfigPayload(displayGroup, playlists, assets) {
  return {
    name: displayGroup.name,
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
    orientation: displayGroup.orientation,
    resolution: displayGroup.resolution,
    signageBackgroundColor: displayGroup.signageBackgroundColor,
    animationEnable: displayGroup.animationEnable,
    resizeAssets: displayGroup.resizeAssets,
    videoKeepAspect: displayGroup.videoKeepAspect,
    ticker: displayGroup.ticker,
    sleep: displayGroup.sleep,
    reboot: displayGroup.reboot,
    omxVolume: displayGroup.omxVolume,
    enableMpv: displayGroup.enableMpv,
    urlReloadDisable: displayGroup.urlReloadDisable,
    logo: displayGroup.logo,
    logox: displayGroup.logox,
    logoy: displayGroup.logoy,
    lastDeployed: displayGroup.lastDeployed,
  };
}

module.exports = { deployDisplayGroup, buildConfigPayload };
