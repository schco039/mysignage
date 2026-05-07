const router = require('express').Router();
const piAuth = require('../middleware/piAuth');
const ctrl = require('../controllers/pi.controller');

// All piSignage compat routes use Basic auth
router.use(piAuth);

router.get('/files', ctrl.listFiles);
router.get('/files/:file', ctrl.getFile);
router.get('/playlists', ctrl.listPlaylists);
router.get('/playlists/:name', ctrl.getPlaylist);
router.get('/groups', ctrl.listGroups);
router.get('/groups/:id', ctrl.getGroup);
router.get('/settings', ctrl.getSettings);

module.exports = router;
