/**
 * Checks if a playlist or asset is currently valid based on its schedule/validity.
 */

function isActiveNow(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return true;

  // Date range check
  if (schedule.startDate && now < new Date(schedule.startDate)) return false;
  if (schedule.endDate && now > new Date(schedule.endDate)) return false;

  // Day of week check (0=Sun, 6=Sat)
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    if (!schedule.daysOfWeek.includes(now.getDay())) return false;
  }

  // Time-of-day check
  if (schedule.startTime || schedule.endTime) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const start = schedule.startTime ? parseTime(schedule.startTime) : 0;
    const end = schedule.endTime ? parseTime(schedule.endTime) : 24 * 60;

    if (start <= end) {
      // Normal range (e.g. 08:00-18:00)
      if (currentMinutes < start || currentMinutes > end) return false;
    } else {
      // Overnight range (e.g. 22:00-06:00)
      if (currentMinutes < start && currentMinutes > end) return false;
    }
  }

  return true;
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

module.exports = { isActiveNow };
