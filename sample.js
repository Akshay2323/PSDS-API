const bcrypt = require('bcryptjs');
const password = 'password123'; // Example password

bcrypt.hash(password, 10, (err, hashedPassword) => {
  if (err) throw err;
  console.log(hashedPassword);
});