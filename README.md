Node Express Server

Handles API Requests from React, users must have valid token, obtained from signin app (nextjs-auth).

Dev: node api-server.js dev

Prod: forever api-server.js prod

> cd /var/www/dev/dev-api.djfan.app && forever start api-server.js prod
> cd /var/www/dev/dev-api.djfan.app && forever stop api-server.js && forever start api-server.js prod && forever list
> forever list # to see processes running in background, you can stop the process by script name

.env settings

DEV_DB_HOST=
DEV_DB_USER=
DEV_DB_PASSWORD=

PROD_DB_HOST=
PROD_DB_USER=
PROD_DB_PASSWORD=

Request: /artist/{profile_url} to get DJ profile

Request: /posts/{post_id} to get all posts including video, audio or images

Tokens are cached with Node-Cache.

Todo:
Profiles & Posts caching with memcached server
Filter post on accesslevel
Filter post on type
Log rotation

Routes:

/me (get) response user object {}

/me (post) json {"first_name":"","last_name":""}

/usercheck (get) ?email= ?username= To check if email or username exists to create a new one or to change

/me/reset_password (get) sends email with reset token

/me/reset_password (post) {"password":"","hash_key":""} (hash_key is the token, valid for 60 minutes)

/me/confirm_email/:verify_hash (get)
