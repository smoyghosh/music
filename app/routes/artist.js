const logger = require("../logger");
const events = require("../api/events");
const middleware = require("./middleware/middleware");
const djprofile = require("../api/djprofile");
const posts = require("../api/posts");
const user = require("../api/user");
const products = require("../api/products");
const stripeHandler = require("../../app/stripe");
const express = require("express");
const router = express.Router();

router.get("/explore", function (req, res) {
  try {
    let params = {
      type: "explore",
      start: req.query["_start"] || 0,
      limit: 16, 
      type: req.query["_type"] || 0,
    };
    djprofile.getDjProfiles(params, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

/* ARTIST Path */
router.get("/:djname", function (req, res) {
  try {
    djprofile.get(req.params.djname, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result[0] });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/posts", function (req, res) {
  try {
    let params = {
      select: req.query["_select"] || "all",
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
      type: req.query["_type"] || 0,
      user_key: req.user_key,
      admin_access: req.admin_access || false,
    };
    params.user_id = req.user_id || 0;
    djprofile.getUserId(req.params.djname, function (djUserId) {
      if (!djUserId) {
        return res.status(404).json({ result: false });
      } else {
        posts.get(djUserId, params, function (result) {
          if (!result) {
            return res.status(200).json({ result: false });
          } else {
            return res.status(200).json({ result: result });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/post/:postid", function (req, res) {
  try {
    let params = {
      user_id: req.user_id,
      user_key: req.user_key,
      post_id: req.params.postid,
      admin_access: req.admin_access || false,
    };
    djprofile.getUserId(req.params.djname, function (djUserId) {
      if (!djUserId) {
        return res.status(404).json({ result: false });
      } else {
        posts.get(djUserId, params, function (result) {
          if (!result) {
            return res.status(200).json({ result: false });
          } else {
            return res.status(200).json({ result: result });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/events", function (req, res) {
  try {
    let params = {
      period: req.query["_period"] || "upcoming",
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    djprofile.getUserId(req.params.djname, function (userId) {
      // get DJ user id by name if not found return false
      if (!userId) {
        return res.status(404).json({ result: false });
      } else {
        params.user_id = userId;
        events.get(params, function (result) {
          if (!result) {
            return res.status(200).json({ result: false });
          } else {
            return res.status(200).json({ result: result });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/event/:event_id/guestlistpass", function (req, res) {
  try {
    let params = {
      event_id: req.params.event_id,
      fan_id: req.user_id || 0,
    };
    djprofile.getUserId(req.params.djname, function (userId) {
      // get DJ user id by name if not found return false
      if (!userId) {
        return res.status(404).json({ result: false });
      } else {
        params.dj_user_id = userId;
        events.getEventAvailablePasses(params, function (result) {
          return res.status(200).json(result);
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/event/:event_id", function (req, res) {
  try {
    let params = {
      event_id: req.params.event_id,
      fan_id: req.user_id || 0,
    };
    djprofile.getUserId(req.params.djname, function (userId) {
      // get DJ user id by name if not found return false
      if (!userId) {
        return res.status(404).json({ result: false });
      } else {
        params.user_id = userId;
        events.get(params, function (result) {
          if (!result) {
            return res.status(200).json({ result: false });
          } else {
            return res.status(200).json({ result: result });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/:djname/event/:event_id/guestlist", function (req, res) {
  try {
    let params = {
      event_id: req.params.event_id || 0,
      fan_id: req.user_id || 0,
    };
    djprofile.getUserId(req.params.djname, function (userId) {
      if (!userId) {
        return res.status(404).json({ result: false });
      } else {
        params.user_id = userId; // user_id owner guestlist
        events.getGuestlist(params, function (result) {
          return res.status(200).json(result);
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.patch(
  "/:djname/event/:event_id/guestlist",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {
        event_id: req.params.event_id || 0,
        fan_id: req.user_id || 0,
        signup: req.body.signup,
      };
      djprofile.getUserId(req.params.djname, function (userId) {
        if (!userId) {
          return res.status(404).json({ result: false });
        } else {
          events.setGuestlist(params, function (result) {
            return res.status(200).json(result);
          });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get("/:djname/connect", middleware.requireUserKey, function (req, res) {
  try {
    djprofile.getUserId(req.params.djname, function (djId) {
      // get DJ user id by name if not found return false
      if (!djId) {
        return res.status(404).json({ result: false });
      } else {
        user.doConnect(req.user_key, djId, function (result) {
          if (result) {
            return res.status(200).json(result);
          } else {
            return res.status(200).json({ result: false });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.patch(
  "/:djname/connect",
  middleware.requireUserKey,
  function (req, res) {
    try {
      djprofile.getUserId(req.params.djname, function (djId) {
        // get DJ user id by name if not found return false
        if (!djId) {
          return res.status(404).json({ result: false });
        } else {
          user.doConnect(req.user_key, djId, function (result) {
            if (result) {
              return res.status(200).json(result);
            } else {
              return res.status(200).json({ result: false });
            }
          });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get(
  "/:djname/messagebundle_paymentlink",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.djname = req.params.djname;
      params.user_key = req.user_key;
      params.user_id = req.user_id;
      products.getMessageBundleProduct(params, function (product) {
        if (product) {
          product.user_key = params.user_key;
          stripeHandler.getPaymentLink(product, function (result) {
            if (!result) {
              return res.status(200).json({ result: false });
            } else {
              return res.status(200).json({ result: result });
            }
          });
        } else {
          return res
            .status(200)
            .json({ result: false, message: "product not avaiable" });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get(
  "/:djname/messagebundle",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.djname = req.params.djname;
      params.user_key = req.user_key;
      params.user_id = req.user_id;
      products.getMessageBundleProduct(params, function (messageBundleProduct) {
        if (messageBundleProduct) {
          let params = {};
          params.start = 0;
          params.limit = 1;
          params.user_key = req.user_key;
          params.seach = {};
          params.seach.id = messageBundleProduct.product_id;
          params.seach.type = 5;
          params.seach.dj_name = req.params.djname;
          products.get(params, function (product) {
            if (!product) {
              return res
                .status(200)
                .json({ result: false, message: "product not avaiable .. " });
            } else {
              return res.status(200).json({ result: product });
            }
          });
        } else {
          return res
            .status(200)
            .json({ result: false, message: "product not avaiable ." });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get(
  "/:djname/membership/link",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.djname = req.params.djname;
      params.type = req.query["_type"] || "gold";
      params.redirect_url = req.query["_redirect_url"] || "";
      params.user_key = req.user_key;
      params.accesslevel_id = req.params.accesslevel_id || 0;
      params.profile_url = req.params.djname;

      if (params.accesslevel_id == 0) {
        if (params.type == "gold") {
          params.accesslevel_id = 2;
        }
        if (params.type == "vip") {
          params.accesslevel_id = 3;
        }
        if (params.type == "trial") {
          params.accesslevel_id = 3;
        }
      }
      products.getMembershipProduct(params, function (product) {
        if (product) {
          product.user_key = params.user_key;
          product.redirect_url = params.redirect_url;
          stripeHandler.getPaymentLink(product, function (result) {
            if (!result) {
              return res.status(200).json({ result: false });
            } else {
              return res.status(200).json({ result: result });
            }
          });
        } else {
          return res
            .status(200)
            .json({ result: false, message: "product not found" });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get("/:djname/products", function (req, res) {
  try {
    let params = {
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    params.seach = {};
    params.seach.dj_name = req.params.djname;
    params.seach.type = req.query["_type"] || 0;
    params.user_key = req.user_key;
    products.get(params, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get(
  "/:djname/product/:id",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.user_key = req.user_key;
      params.dj_name = req.params.djname;
      params.product_id = req.params.id;
      products.get(params, function (result) {
        if (!result) {
          return res.status(200).json({ result: false });
        } else {
          return res.status(200).json({ result: result });
        }
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get("/:djname/trial", middleware.requireUserKey, function (req, res) {
  try {
    let params = {};
    params.user_key = req.user_key;
    djprofile.getUserId(req.params.djname, function (djId) {
      // get DJ user id by name if not found return false
      if (!djId) {
        return res.status(404).json({ result: false, message: "dj not found" });
      } else {
        products.getTrialProductByDjUserId(djId, function (product) {
          if (!product) {
            return res
              .status(404)
              .json({ result: false, message: "product not found" });
          } else {
            params.product_id = product.id;
            stripeHandler.getPaymentLink(params, function (result) {
              if (!result) {
                return res.status(200).json({
                  result: false,
                  message: "stripe no product found",
                });
              } else {
                return res.status(200).json({ result: result });
              }
            });
          }
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

module.exports = router;
