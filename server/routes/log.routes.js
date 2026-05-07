const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const logCtrl = require('../controllers/log.controller');

router.get('/', auth, logCtrl.list);
router.delete('/', auth, rbac('logs', 'delete'), logCtrl.clear);

module.exports = router;
