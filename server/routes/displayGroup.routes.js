const router = require('express').Router();
const ctrl = require('../controllers/displayGroup.controller');
const { auth, requireRole } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

router.use(auth);

router.get('/', rbac('DisplayGroup', 'list'), ctrl.list);
router.get('/:id', rbac('DisplayGroup', 'read'), ctrl.get);
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', rbac('DisplayGroup', 'update'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
