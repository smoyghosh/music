const middleware = {}

middleware.requireUserKey = (req, res, next) => {
    if (!req.user_key) {
        res.status(200).json({'result':false,'message':'missing token'});
    } else {
        next()
    }
}

module.exports = middleware;