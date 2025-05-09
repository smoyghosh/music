const {DataTypes} = require("sequelize");
const sequelize = require("../sequelize");

const userModel = sequelize.define("user", {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        unique: true,
    },
    display_name: {
      type: DataTypes.STRING,
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
    },
    user_key: {
        type: DataTypes.INTEGER,
        unique: true,
    }, 
    avatar: {
      type: DataTypes.STRING,
    }, 
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  });

module.exports = userModel;