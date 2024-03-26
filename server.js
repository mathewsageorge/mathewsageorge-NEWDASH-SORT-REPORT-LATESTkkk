// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const twilio = require('twilio');
const exceljs = require('exceljs');
const PDFDocument = require('pdfkit');



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect('mongodb+srv://mathewsgeorge202:ansu@cluster0.ylyaonw.mongodb.net/Teachers_List?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Twilio Configuration
const accountSid = 'ACc07160ca1b3e33d178f16e780fc7d96a';
const authToken = '5f349cd4490298615846b4fbde01b50f';
const client = new twilio(accountSid, authToken);

// Handle POST request to send SMS
app.post('/send-sms', async (req, res) => {
    const { studentName } = req.body;

    if (!studentName) {
        return res.status(400).json({ error: 'Missing studentName in request body' });
    }

    // Logic to retrieve the student's phone number and send SMS using Twilio
    // Modify this part according to your implementation
    const phoneNumber = '+1234567890'; // Example phone number
    client.messages.create({
        body: 'TEST MESSAGE',
        to: '+919544461968',
        from: '+14243835712' // Your Twilio phone number
    })
    .then(message => {
        console.log('SMS sent successfully:', message.sid);
        res.sendStatus(200);
    })
    .catch(error => {
        console.error('Error sending SMS:', error);
        res.status(500).send('Failed to send SMS');
    });
});

// Define mongoose schema and model for attendance data
const attendanceSchema = new mongoose.Schema({
    serialNumber: String,
    logData: String,
    time: Date,
    period:String,
    subject:String
});

// Define the schema for student serial numbers
const studentSerialNoSchema = new mongoose.Schema({
    serialNumber: String
});

// Create a model based on the schema
const StudentSerialNo = mongoose.model('StudentSerialNo', studentSerialNoSchema);

// User Data
const users = {
    mathews: { username: 'mathews', password: '1', collection: 'mathews_records' },
    keshav: { username: 'keshav', password: '2', collection: 'abel_records' },
    ansu: { username: 'ansu', password: '3', collection: 'kevin_records' },
    neha: { username: 'neha', password: '4', collection: 'sonu_records' }
};

// Function to map serial numbers to student names
function mapSerialToStudentName(serialNumber) {
    const serialToNameMap = {
        "05:34:6a:64:26:b0:c1": "SONU",
        "05:39:01:60:06:b0:c1":"ADWIDTH",
        "05:33:96:60:06:b0:c1":"KEVIN",
        "05:33:96:60:06:b0:a1":"ABEL",
        "05:33:96:60:06:b0:d1":"Disha",
        "05:33:96:60:06:b0:e1":"JOSEPH",
        "05:33:96:60:06:b0:f1":"MERLIN"
        // Add more mappings as needed
    };
    return serialToNameMap[serialNumber] || "Unknown"; // Return student name or "Unknown" if not found
}

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (user && user.password === password) {
        try {

            // Fetch data from the MongoDB collection
        const StudentSerialNos = mongoose.model('StudentSerialNos', studentSerialNoSchema, 'student_serialno');
        const studentSerialNosData = await StudentSerialNos.find({});

            // Fetch attendance data from MongoDB based on the selected collection
            const Attendance = mongoose.model('Attendance', attendanceSchema, user.collection);
            const attendanceData = await Attendance.find({});

            // Extract unique periods from attendance data
             const uniquePeriods = [...new Set(attendanceData.map(data => data.period))];
            
            // Extract unique subjects from attendance data
            const uniqueSubjects = [...new Set(attendanceData.map(data => data.subject))];
            
            // Map attendance data to include student names
            const mappedAttendanceData = attendanceData.map(data => {
                return {
                    studentName: mapSerialToStudentName(data.serialNumber),
                    logData: data.logData,
                    time: data.time,
                    period: data.period,
                    subject: data.subject
                };
            });

            res.render('dashboard', { username: user.username, students: user.students, attendanceData: mappedAttendanceData, periods: uniquePeriods, subjects: uniqueSubjects,studentSerialNos: studentSerialNosData });
        } catch (err) {
            console.error('Error retrieving attendance data:', err);
            res.render('error', { message: 'Error retrieving attendance data' });
        }
    } else {
        res.render('error', { message: 'Invalid username or password' });
    }
});

app.get('/generate-excel-report', async (req, res) => {
    try {
        // Fetch attendance data from the MongoDB collection
        const Attendance = mongoose.model('Attendance', attendanceSchema);
        const attendanceData = await Attendance.find({});

        // Create a new Excel workbook and worksheet
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('NFC Attendance Report');

        // Define column headers
        worksheet.columns = [
            { header: 'Serial Number', key: 'serialNumber', width: 15 },
            { header: 'Log Data', key: 'logData', width: 30 },
            { header: 'Time', key: 'time', width: 20 },
            { header: 'Period', key: 'period', width: 15 },
            { header: 'Subject', key: 'subject', width: 20 },
        ];

        // Add data rows
        attendanceData.forEach(data => {
            worksheet.addRow({
                serialNumber: mapSerialToStudentName(data.serialNumber),
                logData: data.logData,
                time: data.time.toString(), // Convert date object to string
                period: data.period,
                subject: data.subject,
            });
        });

        // Generate Excel file
        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Set response headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // Send the Excel file as response
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Failed to generate Excel report');
    }
});

app.get('/generate-pdf-report', async (req, res) => {
    try {
        // Fetch attendance data from the MongoDB collection
        const Attendance = mongoose.model('Attendance', attendanceSchema);
        const attendanceData = await Attendance.find({});

        // Create a new PDF document
        const doc = new PDFDocument();

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add content to the PDF document
        doc.fontSize(16).text('NFC Attendance Report', { align: 'center' }).moveDown();
        attendanceData.forEach(data => {
            doc.text(`Serial Number: ${mapSerialToStudentName(data.serialNumber)}`);
            doc.text(`Log Data: ${data.logData}`);
            doc.text(`Time: ${data.time.toString()}`);
            doc.text(`Period: ${data.period}`);
            doc.text(`Subject: ${data.subject}`);
            doc.moveDown();
        });

        // Finalize the PDF document
        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Failed to generate PDF report');
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
