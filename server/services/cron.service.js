const UserGroup = require('../models/UserGroup');
const Player = require('../models/Player');
const { deployForUserGroup } = require('./deploy.service');
const { emitToPlayer } = require('../socket/emitter');
const { log } = require('./log.service');

// Zwei separate Intervalle:
// - Schedule-Re-Deploy ist teurer (DB-Queries + file sync) → alle 5 Min
// - CEC-Sleep-Check ist nur ein Socket-Emit → jede Minute für präzises Timing
const DEPLOY_INTERVAL_MS = 5 * 60 * 1000;
const CEC_INTERVAL_MS = 60 * 1000;

let deployTimer = null;
let cecTimer = null;

function start(ioInstances) {
  console.log('Cron service started (deploy: 5 min, CEC: 1 min)');
  runDeploy(ioInstances);
  runCec(ioInstances);
  deployTimer = setInterval(() => runDeploy(ioInstances), DEPLOY_INTERVAL_MS);
  cecTimer = setInterval(() => runCec(ioInstances), CEC_INTERVAL_MS);
}

function stop() {
  if (deployTimer) clearInterval(deployTimer);
  if (cecTimer) clearInterval(cecTimer);
  deployTimer = null;
  cecTimer = null;
}

async function runDeploy(ioInstances) {
  try {
    const io = ioInstances.io;
    const groups = await UserGroup.find();
    for (const group of groups) {
      try {
        await deployForUserGroup(group._id, io);
      } catch (err) {
        console.error(`Cron deploy error for group ${group.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Cron deploy run error:', err.message);
  }
}

async function runCec(ioInstances) {
  try {
    const groups = await UserGroup.find({ 'sleep.enable': true });
    for (const group of groups) {
      if (!group.sleep?.ontime || !group.sleep?.offtime) continue;
      try {
        await checkSleep(ioInstances, group);
      } catch (err) {
        console.error(`Cron sleep error for group ${group.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Cron CEC run error:', err.message);
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

  // CEC-Commands sind idempotent — immer gewünschten State senden.
  // Logging nur bei State-Wechsel um Spam zu vermeiden.
  for (const player of players) {
    await emitToPlayer(ioInstances, player._id, 'cmd', {
      cmd: 'tvpower',
      args: { on: shouldBeOn },
    });
    if (player.tvStatus !== shouldBeOn) {
      await log('cec', `TV ${shouldBeOn ? 'ON' : 'OFF'} (schedule)`, {
        player: player.name || player.cpuSerialNumber,
        playerId: player._id,
        userGroup: group.name,
      });
    }
  }
}

module.exports = { start, stop };
