const config = require("../config");
const express = require('express');
const logger = require("../app/logger");
const scanner = require("../api/scanner");
const router = express.Router();

/*
router.get('/', (req, res) => { 
  let params = {
    "start": req.query['_start'] || 0,
    "limit": req.query['_length'] || req.query['_limit'] ||  10,    
  };  
  params.user_id = req.user_id;
  try {
    venue.get(params, function(result) { 
      return res.status(200).json(result);
    });
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});
  } 
});
*/

module.exports = router;