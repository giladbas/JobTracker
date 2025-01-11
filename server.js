const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// בדוק שמשתני הסביבה מוגדרים
if (!process.env.CLIENT_EMAIL || !process.env.PRIVATE_KEY) {
  console.error("Missing CLIENT_EMAIL or PRIVATE_KEY environment variables");
  process.exit(1); // עצור את השרת אם משתנים חסרים
}

const client_email = process.env.CLIENT_EMAIL;
const private_key = process.env.PRIVATE_KEY.replace(/\\n/g, '\n'); // המרת \\n למעברי שורה אמיתיים


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
    const { date, title, company, location, description, link, status, notes } = req.body;
    if (!date || !title || !company) {
      return res.status(400).send('Missing required fields');
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'RAW',
      resource: {
        values: [[date, title, company, location || '', description || '', link || '', status || 'Pending', notes || '']],
      },
    });
    res.status(201).send('Job added successfully');
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// הוספת נתיב מחיקה
app.delete('/jobs', async (req, res) => {
  try {
    const { date, title } = req.query;
    
    // קבלת כל הנתונים
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).send('No data found');
    }

    // מציאת האינדקס של השורה למחיקה
    const headers = rows[0];
    const dateIndex = headers.indexOf('date');
    const titleIndex = headers.indexOf('title');
    
    const rowIndex = rows.findIndex((row, index) => {
      if (index === 0) return false; // דילוג על שורת הכותרות
      return row[dateIndex] === date && row[titleIndex] === title;
    });

    if (rowIndex === -1) {
      return res.status(404).send('Job not found');
    }

    // מחיקת השורה
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }]
      }
    });

    res.status(200).send('Job deleted successfully');
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// נדכון רשומה קיימת
app.put('/jobs', async (req, res) => {
  try {
    const { date, title } = req.query;
    const updatedJob = req.body;
    
    // קבלת כל הנתונים
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).send('No data found');
    }

    // מציאת האינדקס של השורה לעדכון
    const headers = rows[0];
    const dateIndex = headers.indexOf('date');
    const titleIndex = headers.indexOf('title');
    
    const rowIndex = rows.findIndex((row, index) => {
      if (index === 0) return false;
      return row[dateIndex] === date && row[titleIndex] === title;
    });

    if (rowIndex === -1) {
      return res.status(404).send('Job not found');
    }

    // עדכון השורה
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          updatedJob.date,
          updatedJob.title,
          updatedJob.company,
          updatedJob.location,
          updatedJob.description,
          updatedJob.link || '',
          updatedJob.status || 'ממתין לתשובה',
          updatedJob.notes || ''
        ]]
      }
    });

    res.status(200).send('Job updated successfully');
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// נתיב ברירת מחדל ל-GET /
app.get('/', (req, res) => {
  res.send('Welcome to the Job Tracker API! Use /jobs to interact with the application.');
});

// הגדרת השרת
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

