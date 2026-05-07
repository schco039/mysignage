const router = require('express').Router();
const ctrl = require('../controllers/playlist.controller');
const { auth } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

router.use(auth);

router.get('/', rbac('Playlist', 'list'), ctrl.list);
router.get('/:id', rbac('Playlist', 'read'), ctrl.get);
router.post('/', rbac('Playlist', 'create'), ctrl.create);
router.put('/:id', rbac('Playlist', 'update'), ctrl.update);
router.delete('/:id', rbac('Playlist', 'delete'), ctrl.remove);

// Deploy an Player-IDs (vom Schedule aufgerufen)
router.post('/deploy-players', rbac('Playlist', 'create'), ctrl.deployToPlayers);

module.exports = router;
