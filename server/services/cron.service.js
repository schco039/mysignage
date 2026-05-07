const UserGroup = require('../models/UserGroup');
const Player = require('../models/Player');
const { deployForPlayer, deployForUserGroup } = require('./deploy.service');
const { emitToPlayer } = require('../socket/emitter');
const { log } = require('./log.service');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer = null;

function start(ioInstances) {
  console.log('Cron service started (every 5 min)');
  run(ioInstances);
  timer = setInterval(() => run(ioInstances), INTERVAL_MS);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function run(ioInstances) {
  try {
    const io = ioInstances.io;
    const groups = await UserGroup.find();

    for (const group of groups) {
      // 1. Re-deploy (prüft Schedule + Validity)
      try {
        await deployForUserGroup(group._id, io);
      } catch (err) {
        console.error(`Cron deploy error for group ${group.name}:`, err.message);
      }

      // 2. Sleep/CEC Zeiten prüfen
      if (group.sleep?.enable && group.sleep.ontime && group.sleep.offtime) {
        try {
          await checkSleep(ioInstances, group);
        } catch (err) {
          console.error(`Cron sleep error for group ${group.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Cron run error:', err.message);
  }
}

async function checkSleep(ioInstances, group) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [onH, onM] = group.sleep.ontime.split(':').map(Number);
  const [offH, offM] = group.sleep.offtime.split(':').map(Number);
  const onMinutes = onH * 60 + (onM || 0);
  const offMinutes = offH * 60 + (offM || 0);

  let shouldBeOn;
  if (onMinutes <= offMinutes) {
    shouldBeOn = currentMinutes >= onMinutes && currentMinutes < offMinutes;
  } else {
    shouldBeOn = currentMinutes >= onMinutes || currentMinutes < offMinutes;
  }

  const players = await Player.find({
    userGroups: group._id,
    isConnected: true,
  });

  for (const player of players) {
    if (player.tvStatus !== shouldBeOn) {
      await emitToPlayer(ioInstances, player._id, 'cmd', {
        cmd: 'tvpower',
        args: { on: shouldBeOn },
      });
      await log('cec', `TV ${shouldBeOn ? 'ON' : 'OFF'}`, {
        player: player.name || player.cpuSerialNumber,
        playerId: player._id,
        userGroup: group.name,
      });
    }
  }
}

module.exports = { start, stop };
