const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const subscriptionModel = sequelize.define("subscriptions", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
    }, 
    user_key: {
        type: DataTypes.STRING,
    }, 
    dj_user_id: {
        type: DataTypes.INTEGER,
    }, 
    created_at: {
        type: DataTypes.DATE,
    },   
    updated_at: {
        type: DataTypes.DATE,
    },     
    period_start: {
        type: DataTypes.DATE,
    },   
    period_end: {
        type: DataTypes.DATE,
    }, 
    subscription: {
        type: DataTypes.STRING,
    },   
    customer: {
        type: DataTypes.STRING,
    },   
    amount: {
        type: DataTypes.STRING,
    },   
    accesslevel: {
        type: DataTypes.INTEGER,
    },   
    description: {
        type: DataTypes.STRING,
    },   
    product_id: {
        type: DataTypes.INTEGER,
    }, 
    status_id: {
        type: DataTypes.INTEGER,
    }, 
});

module.exports = subscriptionModel;