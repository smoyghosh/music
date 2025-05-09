const config = require("../../config");
const express = require('express');
const router = express.Router();
const logger = require("../logger");
const cache = require("../api/cache");

router.get('/getStats', (req, res) => { 
  try {
    if (req.query.module == undefined || req.query.module == ""){
      return res.status(500).json({'result':false,'message':'module missing'});
    }
    cache.getStats(req.query.module, function (result) {
      return res.status(200).json( result );      
    });
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});
  } 
});

router.get('/flushAll', (req, res) => {
  try {
    if (req.query.module == undefined || req.query.module == ""){
      return res.status(500).json({'result':false,'message':'module missing'});
    }
    cache.flushAll(req.query.module, function (result) {
      return res.status(200).json( result );      
    });
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});
  } 
});

router.get('/keys', (req, res) => {
    if (req.query.module == undefined || req.query.module == ""){
      return res.status(500).json({'result':false,'message':'module missing'});
    }
    try {
        cache.keys(req.query.module, function (result) {
        return res.status(200).json( result );      
    });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});
    } 
});


/*
router.get('/status', (req, res) => {
  try {
    res.sendFile(__dirname + '/test/support.html');
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});
  }   
});
*/ 

module.exports = router;