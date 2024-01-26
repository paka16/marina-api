const router = module.exports = require('express').Router();

router.use('/boats', require('./boats'));
router.use('/owners', require('./owners'));
router.use('/loads', require('./loads'));

