const Player = require('../models/Player');

/**
 * Emit an event to a specific player by player ID.
 * Tries all three Socket.IO instances.
 */
async function emitToPlayer(ioInstances, playerId, event, data) {
  const player = await Player.findById(playerId);
  if (!player || !player.isConnected || !player.socket) {
    return false;
  }

  const { ioDefault, ioNew, ioWs } = ioInstances;

  // Try the correct transport based on player flags
  if (player.webSocket && ioWs) {
    ioWs.to(player.socket).emit(event, data);
  } else if (player.newSocketIo && ioNew) {
    ioNew.to(player.socket).emit(event, data);
  } else if (ioDefault) {
    ioDefault.to(player.socket).emit(event, data);
  }

  return true;
}

module.exports = { emitToPlayer };
