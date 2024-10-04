import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";
import multer from "multer";
import session from 'express-session';
import path from 'path';

dotenv.config();

const port = 3000;
const app = express();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Connect to the PostgreSQL database
db.connect();

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

// GET ROUTE FOR SIGN-UP
app.get('/signup', (req, res) => {
  res.render('sign-up'); // This renders sign-up.ejs
});

// POST ROUTE FOR SIGNUP
app.post('/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  
  try {
    // Generate salt and hash the password with 10 salt rounds
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user data into the database
    await db.query(
      'INSERT INTO admins (username, email, password, role) VALUES ($1, $2, $3, $4)', 
      [username, email, hashedPassword, role]
    );
    
    // Redirect to the login page after successful signup
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registering user');
  }
});


// GET ROUTE FOR LOGIN
app.get('/login', (req, res) => {
  res.render('login'); // This renders login.ejs
});

// POST ROUTE for LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in the database
    const userResult = await db.query('SELECT * FROM admins WHERE email = $1', [email]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Compare entered password with stored hashed password
      const validPassword = await bcrypt.compare(password, user.password);

      if (validPassword) {
        // If valid, redirect to the dashboard
        res.redirect('/dashboard');
      } else {
        // If password is incorrect, send an error
        res.status(400).send('Incorrect password');
      }
    } else {
      // If user does not exist
      res.status(400).send('User does not exist');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in');
  }
});


//GET ROUTE FOR THE DASHBOARD
app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
      totalExpenses: 0,   
      totalRevenue: 0,       
      totalSubscriptions: 0,  
      netIncome: 0        
  });
});

// GET ROUTE FOR VIEW EXPENSES
app.get('/viewExpenses', (req, res) => {
  // Dummy data for now
  const expenses = [
      { expenseAmount: 50000, revenueAmount: 70000, category: 'Office Supplies', notes: 'Printer ink', date: '2024-10-03' },
      { expenseAmount: 25000, revenueAmount: 40000, category: 'Travel', notes: 'Client meeting', date: '2024-10-01' }
  ];
  
  // Render the viewExpenses.ejs file and pass the data
  res.render('viewExpenses', { expenses });
});

// Sample subscriptions data
const subscriptions = [
  {
      id: 1,
      student_name: "John Doe",
      package_name: "Premium Plan",
      package_type: "Monthly",
      start_date: "2024-01-01",
      end_date: "2024-02-01",
      installment: "First",
      amount_paid: 50000,
      payment_status: "Paid"
  },
  {
      id: 2,
      student_name: "Jane Smith",
      package_name: "Basic Plan",
      package_type: "Yearly",
      start_date: "2024-01-01",
      end_date: "2025-01-01",
      installment: "First",
      amount_paid: 20000,
      payment_status: "Pending"
  }
];

// GET ROUTE FOR MANAGE SUBSCRIPTIONS
app.get('/manageSubscriptions', (req, res) => {
  res.render('manageSubscriptions', { subscriptions });
});

// Sample static data for students
const students = [
  { name: 'John Doe', student_number: 'S12345', email: 'john@example.com', contact_number: '0701234567' },
  { name: 'Jane Smith', student_number: 'S12346', email: 'jane@example.com', contact_number: '0701234568' },
  { name: 'Alice Johnson', student_number: 'S12347', email: 'alice@example.com', contact_number: '0701234569' },
];

// GET ROUTE FOR VIEW STUDENTS
app.get('/viewStudents', (req, res) => {
  try {
      // Render the viewStudents.ejs template and pass the sample students data
      res.render('viewStudents', { students: students });
  } catch (error) {
      console.error('Error rendering viewStudents:', error);
      res.status(500).send('Internal Server Error'); // Send error response if there is an issue
  }
});

// GET ROUTE FOR REPORTS
app.get('/reports', (req, res) => {
  res.render('reports'); // This will render generateReports.ejs
});


// START THE SERVER
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});