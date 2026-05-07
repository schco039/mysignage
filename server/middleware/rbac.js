const UserGroup = require('../models/UserGroup');

// Cache user permissions for 5 minutes
const permCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function resolvePermissions(userId) {
  const key = userId.toString();
  const cached = permCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const userGroups = await UserGroup.find({ members: userId }).lean();
  const userGroupIds = userGroups.map((ug) => ug._id.toString());

  const data = { userGroupIds };
  permCache.set(key, { data, ts: Date.now() });
  return data;
}

function invalidatePermCache(userId) {
  if (userId) {
    permCache.delete(userId.toString());
  } else {
    permCache.clear();
  }
}

function rbac(resource, action) {
  return async (req, res, next) => {
    try {
      // Admins bypass all checks
      if (req.user.role === 'admin') {
        req.userGroupIds = null; // null = alle
        return next();
      }

      const { userGroupIds } = await resolvePermissions(req.user._id);
      req.userGroupIds = userGroupIds;

      // Admin-only resources
      if (['User', 'UserGroup', 'DisplayGroup'].includes(resource)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { rbac, invalidatePermCache };
