const mysql = require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Update with your MySQL username
  password: 'root',  // Update with your MySQL password
  database: 'psds_portfolio', // Your database name
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ', err);
    return;
  }
  console.log('Connected to the MySQL database');
});

module.exports = connection;
