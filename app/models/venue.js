const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const venueModel = sequelize.define("venues", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
    },
    phone: {
        type: DataTypes.STRING,
    }, 
    website: {
        type: DataTypes.STRING,
    },
    capacity: {
        type: DataTypes.STRING,
    },
    blurb: {
        type: DataTypes.STRING,
    },
    photo: {
        type: DataTypes.STRING,
    },
    logo: {
        type: DataTypes.STRING,
    }, 
    address: {
        type: DataTypes.STRING,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  });

module.exports = venueModel;