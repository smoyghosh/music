const config = require("../config");
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
    config.nodeserver.db_djfan,
    config.nodeserver.db_user,
    config.nodeserver.db_password,
     {
       host: config.nodeserver.db_host,
       dialect: 'mariadb',
       define:{
        timestamps: false,
        freezeTableName: true,
        underscored: true,
       },
       logging: false
     }
   );
module.exports = sequelize; 