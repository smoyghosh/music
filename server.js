const express = require("express");
const posts = require("./app/api/posts");
const events = require("./app/api/events");
const scanner = require("./app/api/scanner");
const cors = require("cors");
const user = require("./app/api/user");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const logger = require("./app/logger");
const products = require("./app/api/products");
const search = require("./app/api/search");
const session = require("express-session");
const venuesRoute = require("./app/routes/venues");
const supportRoute = require("./app/routes/support");
const postRoute = require("./app/routes/post");
const productsRoute = require("./app/routes/products");
const artistRoute = require("./app/routes/artist");
const eventsRoute = require("./app/routes/events");
const runtimeConfig = require("./app/runtimeConfig");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload/");
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + "." + file.originalname.split(".").pop().toLowerCase());
  },
});
const upload = multer({
  dest: "upload/",
  limits: { fileSize: 10000000 },
  storage: storage,
}); // 10000000 = 10Mb

runtimeConfig.loadRuntimeConfig();
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 request / min
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const sess = {
  secret: "djfan cookie jar",
  resave: true,
  saveUninitialized: true,
};

var server = {};
const app = express();
app.set("trust proxy", 1);
app.use(session(sess));
app.use(limiter);
app.use(express.json());

app.use(
  cors({
    methods: ["GET,HEAD,PUT,PATCH,POST,DELETE"],
    origin: [
      /djfan\.app$/,
      "http://localhost",
      "http://localhost:5173",
      "https://dev-fan.djfan.app",
      "https://fan.djfan.app",
      "http://127.0.0.1",
      "http://127.0.0.1:5173",
    ],
    optionsSuccessStatus: 200,
    credentials: true,
    preflightContinue: true,
  })
);

app.options(
  "*",
  cors({
    methods: ["GET,HEAD,PUT,PATCH,POST,DELETE"],
    origin: [
      /djfan\.app$/,
      "http://localhost",
      "http://localhost:5173",
      "https://dev-fan.djfan.app",
      "https://fan.djfan.app",
      "http://127.0.0.1",
      "http://127.0.0.1:5173",
    ],
  })
);
// check if json
app.use(function (err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    let errorMessage = [];
    errorMessage.push("json validation failed");
    errorlog.write(err);
    return res.status(422).send("json error");
  }
  next();
});

// servertime out
app.use(function (req, res, next) {
  req.setTimeout(10000, function () {
    if (!res.headersSent) {
      return res.status(408).send("timeout");
    }
  });
  next();
});

/* General */
app.get("/usercheck", function (req, res) {
  try {
    let filter = {
      email: req.query["email"] || "",
      username: req.query["username"] || "",
    };
    user.getCheck(filter, function (result) {
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

app.get("/search", function (req, res) {
  try {
    let params = {
      type: req.query["type"] || "artist",
      query: req.query["query"] || "",
      startdate: req.query["_startdate"] || 0,
      enddate: req.query["_enddate"] || 0,
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    search.search(params, function (result) {
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

app.get("/feed", function (req, res) {
  try {
    let params = {
      select: "home",
      start: 0,
      limit: req.query["_length"] || req.query["_limit"] || 5,
      type: 0,
    };

    posts.getFeed(0, params, function (result) {
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

app.post("/purchase", function (req, res) {
  try {
    let params = req.body;
    params.user_id = req.user_id;
    params.user_key = req.user_key;
    products.purchase(params, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

app.get("/scanner/:event_key", function (req, res) {
  try {
    let params = {
      event_key: req.params.event_key,
    };
    events.getEventIdByEventKey(params, function (result) {
      if (result) {
        return res.status(200).json({ result: true });
      } else {
        return res.status(200).json({ result: false });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

app.get("/scanner/:event_key/:qrcode", function (req, res) {
  try {
    let params = {
      event_key: req.params.event_key,
      qrcode: req.params.qrcode,
    };
    events.getEventIdByEventKey(params, function (result) {
      if (result) {
        params.event_id = result;
        scanner.validateQRcode(params, function (result) {
          if (result) {
            return res.status(200).json(result);
          } else {
            return res.status(200).json({ result: false });
          }
        });
      } else {
        return res.status(200).json({ result: false });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

app.post("/verify/test", (req, res) => {
  try {
    let params = req.body;
    reCaptcha.verifyToken(params.recaptcha, function (response) {
      if (response.verified === true) {
        return res.status(200).json({
          result: true,
          message: "reCaptcha valid",
          verified: response.verified,
        });
      } else {
        return res.status(200).json({
          result: false,
          message: "reCaptcha invalid",
          verified: response.verified,
        });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

app.get("/online", function (req, res) {
  return res.status(200).send("");
});

app.use("/venues", venuesRoute);

app.use("/support", supportRoute);

app.use("/post", postRoute);

app.use("/products", productsRoute);

app.use("/artist", artistRoute);

app.use("/events", eventsRoute);

// last call nothing found / matching so must be 404
app.use(function (req, res, next) {
  if (!res.headersSent) {
    // res.status(200).json({'result':false});
  }
});

// init server
server.init = function (config) {
  app.listen(4000);
  // console.log(
  //   `Server running on port 4000 in ${config.nodeserver.environment} mode`
  // );
};

module.exports = server;
