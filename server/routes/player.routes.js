const router = require('express').Router();
const ctrl = require('../controllers/player.controller');
const { auth, requireRole } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

router.use(auth);

router.get('/', rbac('Player', 'list'), ctrl.list);
router.get('/:id', rbac('Player', 'read'), ctrl.get);
router.put('/:id', rbac('Player', 'update'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);
router.post('/:id/shell', requireRole('admin'), ctrl.shell);
router.post('/:id/screenshot', rbac('Player', 'read'), ctrl.screenshot);
router.post('/:id/reboot', requireRole('admin'), ctrl.reboot);
router.post('/:id/tv-power', rbac('Player', 'update'), ctrl.tvPower);
router.post('/:id/deploy', rbac('Player', 'update'), ctrl.deploy);           // aus Playlists deployen
router.post('/:id/deploy-direct', rbac('Player', 'update'), ctrl.deployDirect); // Direct Assets deployen

module.exports = router;
