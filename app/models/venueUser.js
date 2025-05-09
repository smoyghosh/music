const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const userModel = require("./user");
const venueModel = require("./venue");

const venueUserModel = sequelize.define("venue_user", {
    venue_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: venueModel,
        key: 'id',
      },
    },
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: userModel,
          key: 'id',
        },        
    },
    main: {
        type: DataTypes.INTEGER,
    },
});

module.exports = venueUserModel;