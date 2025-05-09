const config = require("../../config");
const logger = require("../logger");
const venues = require("../api/venues");
const events = require("../api/events");
const express = require('express');
const router = express.Router();
const middleware = require('./middleware/middleware'); 

router.get("/:venueurl/event/:eventurl/guestlist", middleware.requireUserKey, function (req, res) {  
    try {
      let params = {
        "venueurl": req.params.venueurl,
        "eventurl" : req.params.eventurl, 
        fan_id: req.user_id,
      };      
      venues.getVenueUser(params, function (userId) {
        if (userId==0) {
          return res.status(404).json({'result':false});
        } else {        
            params.user_id = userId; 
            params.event_id = params.eventurl;
            venues.getGuestlist(params, function (result) {
              return res.status(200).json(result);
          });
        }
      });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});  
    }
});
  
// /venues/amnesia-ibiza/event/do-not-sleep-ibiza/guestlist
router.patch("/:venueurl/event/:eventurl/guestlist", middleware.requireUserKey, function (req, res) {    
    try {    
      let params = {
        "venueurl": req.params.venueurl || 0,
        "eventurl": req.params.eventurl || 0,        
        "fan_id" : req.user_id || 0, 
        "signup" : req.body.signup   
      };
      venues.getVenueUser(params, function (userId) {
        if (userId==0) {
          return res.status(404).json({'result':false});
        } else {      
          params.user_id = userId;
          events.setGuestlist(params, function (result) {
              return res.status(200).json(result);
          });
        }
      });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});  
    }
});

router.get("/:venueurl/event/:eventurl", function (req, res) { 
    try {    
        let params = {
            "venueurl":req.params.venueurl,
            "eventurl":req.params.eventurl,
        };
        venues.getVenueUser(params, function (userId) {           
            params.user_id = userId; 
            params.event_id = params.eventurl;
            if (userId==0) {
              return res.status(404).json({'result':false});
            } else {        
              events.get(params, function (result) {
                if (!result) {
                  return res.status(200).json({'result':false});
                } else {
                  return res.status(200).json({'result':result});
                }
              });
            }
        });
    } catch(error) {
        logger.log(error);
        return res.status(500).json({'result':false,'message':'error'});
    }
});

router.get("/", function (req, res) { 
    try {  
      let params = {
        "type": 'explore',
        "start": req.query['_start'] || 0,
        "limit": req.query['_length'] || req.query['_limit'] ||  10,
      };  
      venues.get(params, function (result) {
        if (!result) {
          return res.status(200).json({'result':false});
        } else {      
          return res.status(200).json({'result':result});
        }
      });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});
    }
});
  
router.get("/:venueurl", function (req, res) { 
    try {    
      venues.get({"url":req.params.venueurl}, function (result) {
        if (!result) {
          return res.status(200).json({'result':false});
        } else {      
          return res.status(200).json({'result':result});
        }
      });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});
    }
});
  
router.get("/:venue/events", function (req, res) { 
    try {    
      let params = {
        "venue": req.params.venue,
        "period": req.query['_period'] || 'upcoming',  
        "start": req.query['_start'] || 0,
        "limit": req.query['_length'] || req.query['_limit'] ||  10,
      };    
      venues.getEvents(params, function (result) {
        if (!result) {
          return res.status(200).json({'result':false});
        } else {      
          return res.status(200).json({'result':result});
        }
      });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});
    }
});

router.get("/:venue_id/event/:event_id/artists", function (req, res) { 
  try {
    let params = {
      "venue_id": req.params.venue_id,
      "event_id" : req.params.event_id,
    };        
    venues.getEventArtists(params, function(result) { 
      return res.status(200).json(result);
    });
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});
  } 
});

router.get("/:venue_id/event/:event_id/guestlistpass", function (req, res) {   
  try {
    let params = {
      "venue_id": req.params.venue_id,
      "event_id" : req.params.event_id,
    }; 
    params.dj_user_id = userId;
    venues.getEventAvailablePasses(params, function (result) {
        return res.status(200).json(result);
    });
  } catch(error) {
    logger.log(error);
    return res.status(500).json({'result':false,'message':'error'});  
  }
});

router.get("/:venue/connect", middleware.requireUserKey, function (req, res) {  
    try {
        let params = {
            venue: req.params.venue,
            user_key : req.user_key,
            user_id : req.user_id,
        };
        venues.doConnect(params, function (result) {
            return res.status(200).json(result);
        });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});  
    }
});

router.patch("/:venue/connect", middleware.requireUserKey, function (req, res) {  
    try {
        let params = {
            venue: req.params.venue,
            user_key : req.user_key,
            user_id : req.user_id,
        };        
        venues.doConnect(params, function (result) {
            return res.status(200).json(result);
        });
    } catch(error) {
      logger.log(error);
      return res.status(500).json({'result':false,'message':'error'});  
    }
});

module.exports = router;