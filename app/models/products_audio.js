const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const productsAudioModel = sequelize.define("products_audio", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    product_id: {
        type: DataTypes.INTEGER,
    }, 
    location: {
        type: DataTypes.STRING,
    },      
    artwork_cache: {
        type: DataTypes.STRING,
    },      
    filename: {
        type: DataTypes.STRING,
    },      
    label: {
        type: DataTypes.STRING,
    },      
    artist: {
        type: DataTypes.STRING,
    },      
    genre: {
        type: DataTypes.STRING,
    },      
    release_date: {
        type: DataTypes.DATE,
    },      
    release_name: {
        type: DataTypes.STRING,
    },       
    created_at: {
        type: DataTypes.DATE,
    },   
    updated_at: {
        type: DataTypes.DATE,
    },   
  });

module.exports = productsAudioModel;