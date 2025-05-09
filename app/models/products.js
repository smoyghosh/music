const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const productsModel = sequelize.define("products", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
    }, 
    accesslevel_id: {
        type: DataTypes.INTEGER,
    }, 
    name: {
        type: DataTypes.STRING,
    },      
    active: {
        type: DataTypes.BOOLEAN,
    }, 
    default_price: {
        type: DataTypes.JSON,
    },      
    description: {
        type: DataTypes.STRING,
    },   
    stripe_id: {
        type: DataTypes.STRING,
        unique: true,
    },   
    stripe_price_id: {
        type: DataTypes.STRING,
    },   
    image_url: {
        type: DataTypes.STRING,
    },   
    sku: {
        type: DataTypes.STRING,
    },   
    type: {
        type: DataTypes.INTEGER,
    },   
    product_type: {
        type: DataTypes.STRING,
    },   
    created_at: {
        type: DataTypes.DATE,
    },   
    updated_at: {
        type: DataTypes.DATE,
    },   
  });

module.exports = productsModel;