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

// Deploy endpoint on display group
router.post('/deploy/:displayGroupId', rbac('DisplayGroup', 'update'), ctrl.deploy);

module.exports = router;
