const Player = require('../models/Player');
const { deployForPlayer } = require('../services/deploy.service');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log } = require('../services/log.service');

function setupPlayerHandlers(io, transport) {
  io.on('connection', (socket) => {
    console.log(`[${transport}] Player connected: ${socket.id}`);

    socket.on('status', async (settings, status, priority) => {
      try {
        const statusData = {
          ip: socket.handshake.address,
          socket: socket.id,
          ...(typeof status === 'object' ? status : {}),
          ...(typeof settings === 'object' ? settings : {}),
        };

        const cpuSerial = statusData.cpuSerialNumber;
        if (!cpuSerial) {
          console.warn(`[${transport}] Status without cpuSerialNumber from ${socket.id}`);
          return;
        }

        // Upsert player
        const player = await Player.findOneAndUpdate(
          { cpuSerialNumber: cpuSerial },
          {
            $set: {
              isConnected: true,
              socket: socket.id,
              lastReported: new Date(),
              ip: statusData.ip,
              myIpAddress: statusData.myIpAddress,
              ethMac: statusData.ethMac,
              wifiMac: statusData.wifiMac,
              version: statusData.version,
              platform_version: statusData.platform_version,
              piTemperature: statusData.piTemperature,
              uptime: statusData.uptime,
              diskSpaceUsed: statusData.diskSpaceUsed,
              diskSpaceAvailable: statusData.diskSpaceAvailable,
              currentPlaylist: statusData.currentPlaylist,
              playlistOn: statusData.playlistOn,
              playlistStarttime: statusData.playlistStarttime,
              duration: statusData.duration,
              tvStatus: statusData.tvStatus,
              cecTvStatus: statusData.cecTvStatus,
              syncInProgress: statusData.syncInProgress,
              wgetBytes: statusData.wgetBytes,
              wgetSpeed: statusData.wgetSpeed,
              newSocketIo: transport === 'new',
              webSocket: transport === 'websocket',
            },
          },
          { upsert: true, new: true }
        );

        await log('connect', `Player connected via ${transport}`, {
          player: player.name || cpuSerial,
          playerId: player._id,
          details: { ip: statusData.myIpAddress || statusData.ip, version: statusData.version },
        });

        // Config schicken — aus Playlists deployen
        const hasPlaylists = await require('../models/Playlist').countDocuments({ targetPlayers: player._id });

        if (hasPlaylists > 0) {
          // Deploy aus Playlists (emittiert direkt auf den Socket)
          await deployForPlayer(player, io);
        } else if (player.directAssets && player.directAssets.length > 0) {
          // Fallback: Direct Assets
          const Asset = require('../models/Asset');
          const populated = await Asset.find({
            _id: { $in: player.directAssets.map((da) => da.asset) },
          });
          const assetMap = new Map(populated.map((a) => [a._id.toString(), a]));

          const assets = player.directAssets
            .filter((da) => assetMap.has(da.asset.toString()))
            .map((da) => {
              const a = assetMap.get(da.asset.toString());
              return {
                filename: a.filename,
                duration: da.duration || a.duration || 10,
                type: a.type,
                option: { filename: a.filename, duration: da.duration || a.duration || 10, selected: true },
              };
            });

          socket.emit('config', {
            playlists: [{ name: 'Direct Assets', settings: { layout: '1' }, assets }],
            assets: assets.map((a) => ({ filename: a.filename })),
            defaultScreen: player.defaultScreen || 'modern',
          });
        } else {
          // Kein Content — Default Screen schicken
          socket.emit('config', {
            playlists: [],
            assets: [],
            defaultScreen: player.defaultScreen || 'modern',
          });
        }
      } catch (err) {
        console.error(`[${transport}] Status handler error:`, err.message);
      }
    });

    socket.on('snapshot', async (data) => {
      try {
        const player = await Player.findOne({ socket: socket.id });
        if (!player || !data) return;

        const screenshotDir = path.join(config.mediaDir, '_screenshots');
        fs.mkdirSync(screenshotDir, { recursive: true });

        const buffer = Buffer.from(data, 'base64');
        const filePath = path.join(screenshotDir, `${player.cpuSerialNumber}.png`);
        fs.writeFileSync(filePath, buffer);

        console.log(`[${transport}] Screenshot saved for ${player.cpuSerialNumber}`);
      } catch (err) {
        console.error(`[${transport}] Snapshot handler error:`, err.message);
      }
    });

    socket.on('shell_ack', (response) => {
      console.log(`[${transport}] Shell ack from ${socket.id}:`, response);
    });

    socket.on('media_ack', async (response) => {
      try {
        const player = await Player.findOne({ socket: socket.id });
        if (player && response) {
          await log('download', `Asset synced: ${response.filename || JSON.stringify(response)}`, {
            player: player.name || player.cpuSerialNumber,
            playerId: player._id,
            details: response,
          });
        }
      } catch (err) {
        console.error(`[${transport}] Media ack log error:`, err.message);
      }
      console.log(`[${transport}] Media ack from ${socket.id}:`, response);
    });

    socket.on('setplaylist_ack', (response) => {
      console.log(`[${transport}] Setplaylist ack from ${socket.id}:`, response);
    });

    socket.on('upload', async (playerInfo, filename, data) => {
      try {
        const uploadDir = path.join(config.mediaDir, '_uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), data);
        console.log(`[${transport}] Upload received: ${filename}`);
      } catch (err) {
        console.error(`[${transport}] Upload handler error:`, err.message);
      }
    });

    socket.on('disconnect', async (reason) => {
      try {
        const player = await Player.findOneAndUpdate(
          { socket: socket.id },
          { $set: { isConnected: false } }
        );
        if (player) {
          await log('disconnect', `Player disconnected (${reason})`, {
            player: player.name || player.cpuSerialNumber,
            playerId: player._id,
          });
        }
        console.log(`[${transport}] Player disconnected: ${socket.id} (${reason})`);
      } catch (err) {
        console.error(`[${transport}] Disconnect handler error:`, err.message);
      }
    });
  });
}

module.exports = { setupPlayerHandlers };
