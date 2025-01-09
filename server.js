const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// בדוק שמשתני הסביבה מוגדרים
if (!process.env.CLIENT_EMAIL || !process.env.PRIVATE_KEY) {
  console.error("Missing CLIENT_EMAIL or PRIVATE_KEY environment variables");
  process.exit(1); // עצור את השרת אם משתנים חסרים
}

const client_email = process.env.CLIENT_EMAIL;
const private_key = process.env.PRIVATE_KEY;


// הגדרות Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email,
    private_key,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1zIdLC_8hvfSkBZVVPQihFceypirsL03x6z3NhEKhC4w'; // החלף ב-ID של הגיליון שלך
const SHEET_NAME = 'jobs'; // שם הטאב בגיליון שלך

const app = express();
app.use(bodyParser.json());
app.use(cors());


// קבלת כל הנתונים מהגיליון
app.get('/jobs', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      res.json([]);
    } else {
      const headers = rows[0];
      const data = rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
      res.json(data);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// הוספת עבודה חדשה לגיליון
app.post('/jobs', async (req, res) => {
  try {
    const { date, title, company, location, description, link } = req.body;
    if (!date || !title || !company || !location || !description || !link) {
      return res.status(400).send('Missing required fields');
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'RAW',
      resource: {
        values: [[date, title, company, location, description, link]],
      },
    });
    res.status(201).send('Job added successfully');
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});


// נתיב ברירת מחדל ל-GET /
app.get('/', (req, res) => {
  res.send('Welcome to the Job Tracker API! Use /jobs to interact with the application.');
});

// הגדרת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

