const DisplayGroup = require('../models/DisplayGroup');
const Player = require('../models/Player');
const { deployDisplayGroup } = require('./deploy.service');
const { emitToPlayer } = require('../socket/emitter');
const { log } = require('./log.service');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer = null;

function start(ioInstances) {
  console.log('Cron service started (every 5 min)');

  // Run once immediately, then on interval
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
    const groups = await DisplayGroup.find();

    for (const group of groups) {
      // 1. Re-deploy (checks schedule + validity)
      try {
        await deployDisplayGroup(group._id, io);
      } catch (err) {
        console.error(`Cron deploy error for ${group.name}:`, err.message);
      }

      // 2. Check sleep/CEC times
      if (group.sleep?.enable && group.sleep.ontime && group.sleep.offtime) {
        try {
          await checkSleep(ioInstances, group);
        } catch (err) {
          console.error(`Cron sleep error for ${group.name}:`, err.message);
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

  // Determine if TV should be on right now
  let shouldBeOn;
  if (onMinutes <= offMinutes) {
    // Normal range: on 07:00, off 23:00
    shouldBeOn = currentMinutes >= onMinutes && currentMinutes < offMinutes;
  } else {
    // Overnight: on 22:00, off 06:00
    shouldBeOn = currentMinutes >= onMinutes || currentMinutes < offMinutes;
  }

  // Send CEC command to all connected players in this group
  const players = await Player.find({
    'displayGroup._id': group._id,
    isConnected: true,
  });

  for (const player of players) {
    // Only send if TV status differs from desired state
    if (player.tvStatus !== shouldBeOn) {
      await emitToPlayer(ioInstances, player._id, 'cmd', {
        cmd: 'tvpower',
        args: { on: shouldBeOn },
      });
      await log('cec', `TV ${shouldBeOn ? 'ON' : 'OFF'}`, {
        player: player.name || player.cpuSerialNumber,
        playerId: player._id,
        displayGroup: group.name,
      });
    }
  }
}

module.exports = { start, stop };
