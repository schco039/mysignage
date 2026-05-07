const router = require('express').Router();
const authCtrl = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.get('/me', auth, authCtrl.me);
router.put('/password', auth, authCtrl.changePassword);

module.exports = router;
