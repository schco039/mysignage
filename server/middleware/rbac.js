const UserGroup = require('../models/UserGroup');

// Cache user permissions for 5 minutes to avoid repeated DB lookups
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
  const allowedDisplayGroups = [
    ...new Set(userGroups.flatMap((ug) => ug.displayGroups.map((dg) => dg.toString()))),
  ];

  const data = { userGroupIds, allowedDisplayGroups };
  permCache.set(key, { data, ts: Date.now() });
  return data;
}

// Call this when group memberships change
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
        req.allowedDisplayGroups = null; // null = all
        req.userGroupIds = null;
        return next();
      }

      const { userGroupIds, allowedDisplayGroups } = await resolvePermissions(req.user._id);
      req.allowedDisplayGroups = allowedDisplayGroups;
      req.userGroupIds = userGroupIds;

      // Admin-only resources
      if (['User', 'UserGroup'].includes(resource)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (action === 'read' || action === 'list') {
        // Controllers will filter by req.allowedDisplayGroups
        return next();
      }

      if (action === 'create') {
        const dgId = req.body.displayGroup || req.body.displayGroups?.[0];
        if (dgId && !allowedDisplayGroups.includes(dgId.toString())) {
          return res.status(403).json({ error: 'No access to this display group' });
        }
        return next();
      }

      if (action === 'update') {
        // Controller loads resource and checks scope - let it through
        return next();
      }

      if (action === 'delete') {
        // Controller must verify resource.userGroup is in userGroupIds
        return next();
      }

      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { rbac, invalidatePermCache };
