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
app.use(bodyParser.json());

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

// GET ROUTE FOR THE DASHBOARD
app.get('/dashboard', async (req, res) => {
  try {
    // Fetch total expenses
    const totalExpensesResult = await db.query('SELECT SUM(expense_amount) AS total FROM expenses');
    const totalExpenses = totalExpensesResult.rows[0].total || 0;

    // Fetch total revenue
    const totalRevenueResult = await db.query('SELECT SUM(amount) AS total FROM revenue');
    const totalRevenue = totalRevenueResult.rows[0].total || 0;

    // Fetch total subscriptions
    const totalSubscriptionsResult = await db.query('SELECT COUNT(*) AS total FROM subscriptions');
    const totalSubscriptions = totalSubscriptionsResult.rows[0].total || 0;

    // Calculate net income
    const netIncome = totalRevenue - totalExpenses;

    // Render dashboard with totals
    res.render('dashboard', {
      totalExpenses,
      totalRevenue,
      totalSubscriptions,
      netIncome
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching dashboard data');
  }
});


// GET ROUTE FOR VIEW EXPENSES
app.get('/viewExpenses', async (req, res) => {
  try {
      // Fetch all expenses from the database
      const expenses = await db.query('SELECT * FROM expenses ORDER BY date DESC');
      res.render('viewExpenses', { expenses: expenses.rows }); // Pass expenses to EJS template
  } catch (err) {
      console.error('Error retrieving expenses:', err);
      res.status(500).send('Server Error');
  }
});

// POST ROUTE FOR VIEW EXPENSES
app.post('/addExpense', async (req, res) => {
  const { expenseAmount, revenueAmount, category, notes, date } = req.body;

  try {
      // Insert the new expense into the database without net_income (calculated automatically)
      await db.query(
          'INSERT INTO expenses (expense_amount, revenue_amount, category, notes, date) VALUES ($1, $2, $3, $4, $5)',
          [expenseAmount, revenueAmount, category, notes, date]
      );

      // Redirect to view the updated expenses list
      res.redirect('/viewExpenses');
  } catch (err) {
      console.error('Error adding expense:', err);
      res.status(500).send('Server Error');
  }
});

// GET ROUTE FOR GENERATING REPORTS
app.get('/reports', async (req, res) => {
  try {
    // Fetch totals from the database
    const totalExpensesResult = await db.query('SELECT SUM(expense_amount) AS total FROM expenses');
    const totalRevenueResult = await db.query('SELECT SUM(amount) AS total FROM revenue');
    const totalSubscriptionsResult = await db.query('SELECT COUNT(*) AS total FROM subscriptions');

    // Calculate totals
    const totalExpenses = totalExpensesResult.rows[0].total || 0;
    const totalRevenue = totalRevenueResult.rows[0].total || 0;
    const totalSubscriptions = totalSubscriptionsResult.rows[0].total || 0;
    const netIncome = totalRevenue - totalExpenses;

    // Render reports page with totals
    res.render('reports', { 
      totalExpenses, 
      totalRevenue, 
      totalSubscriptions, 
      netIncome 
    });
  } catch (err) {
    console.error('Error fetching report data:', err);
    res.status(500).send('Error generating reports');
  }
});

//GET ROUTE FOR FETCHING DATA
app.get('/api/reports', (req, res) => {
  const { timePeriod } = req.query;

  // Retrieve data based on the timePeriod from your database
  const reportData = getReportData(timePeriod); // Implement this function to fetch data

  res.json(reportData);
});


// GET ROUTE FOR MANAGE SUBSCRIPTIONS
app.get('/manageSubscriptions', async (req, res) => {
  try {
    // Fetch students for dropdown
    const studentsResult = await db.query('SELECT id, name FROM students');
    
    // Fetch packages for dropdown
    const packagesResult = await db.query('SELECT id, package_name, package_type FROM packages');

    // Fetch existing subscriptions with student and package details
    const subscriptionsResult = await db.query(`
      SELECT s.id, st.name AS student_name, p.package_name, p.package_type, s.start_date, s.end_date
      FROM subscriptions s
      JOIN students st ON s.student_id = st.id
      JOIN packages p ON s.package_id = p.id
    `);

    // Render the 'manageSubscriptions' view with all required data
    res.render('manageSubscriptions', {
      students: studentsResult.rows,    // Students for form
      packages: packagesResult.rows,    // Packages for form
      subscriptions: subscriptionsResult.rows  // Existing subscriptions
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Server Error');
  }
});


// POST ROUTE TO ADD A SUBSCRIPTION
app.post('/addSubscription', async (req, res) => {
  const { student_id, package_id, start_date, end_date } = req.body;

  try {
    await db.query(
      'INSERT INTO subscriptions (student_id, package_id, start_date, end_date) VALUES ($1, $2, $3, $4)',
      [student_id, package_id, start_date, end_date]
    );
    res.redirect('/manageSubscriptions');
  } catch (err) {
    console.error('Error adding subscription:', err);
    res.status(500).send('Server Error');
  }
});



// GET ROUTE FOR VIEW STUDENTS
app.get('/viewStudents', async (req, res) => {
  try {
      // Fetch all students from the database
      const result = await db.query('SELECT * FROM students');
      const students = result.rows;

      // Render the EJS template and pass the student data
      res.render('viewStudents', { students });
  } catch (err) {
      console.error('Error fetching students:', err);
      res.status(500).send('Server Error');
  }
});

// POST ROUTE FOR VIEW STUDENTS
app.post('/addStudent', async (req, res) => {
  const { name, student_number, contact_number } = req.body;

  try {
      // Insert new student into the database
      await db.query(
          'INSERT INTO students (name, student_number, contact_number) VALUES ($1, $2, $3 )',
          [name, student_number, contact_number]
      );
      res.redirect('/viewStudents'); // Redirect back to the student view page after adding
  } catch (err) {
      console.error('Error adding student:', err);
      res.status(500).send('Server Error');
  }
});

//GET ROUTE FOR THE PACKAGES PAGE
app.get('/packages', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM packages');
  
    const packages = result.rows;
    res.render('packages', { packages });
  } catch (error) {
    console.error('Error fetching packages from the database:', error);
    res.status(500).send('Server error');
  }
});

//POST ROUTE FOR PACKAGES
app.post('/addPackage', async (req, res) => {
  try {
      // Get data from the form
      const { package_name, package_type, price, duration } = req.body;

      // Insert into the database
      const query = `
          INSERT INTO packages (package_name, package_type, price, duration) 
          VALUES ($1, $2, $3, $4)
      `;

      await db.query(query, [package_name, package_type, price, duration]);

      // Redirect back to the packages page (or wherever you want)
      res.redirect('/packages');
  } catch (error) {
      console.error('Error adding package:', error);
      res.status(500).send('Server error');
  }
});


// START THE SERVER
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});