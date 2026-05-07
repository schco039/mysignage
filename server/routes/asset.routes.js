const router = require('express').Router();
const ctrl = require('../controllers/asset.controller');
const { auth } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/', rbac('Asset', 'list'), ctrl.list);
router.get('/:id', rbac('Asset', 'read'), ctrl.get);
router.post('/', rbac('Asset', 'create'), upload.array('files', 20), ctrl.upload);
router.put('/:id', rbac('Asset', 'update'), ctrl.update);
router.delete('/:id', rbac('Asset', 'delete'), ctrl.remove);

module.exports = router;
