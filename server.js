const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// Root endpoint for Render health checks
app.get('/', (req, res) => res.status(200).send("Server is running."));

// -------------------------------------------------------------------
// DROPDOWN OPTION ENDPOINTS
// -------------------------------------------------------------------
app.all('/get-nth-options', (req, res) => {
    res.json([
        { title: "1st", value: "1" },
        { title: "2nd", value: "2" },
        { title: "3rd", value: "3" },
        { title: "4th", value: "4" }
    ]);
});

app.all('/get-day-options', (req, res) => {
    res.json([
        { title: "Monday", value: "1" },
        { title: "Tuesday", value: "2" },
        { title: "Wednesday", value: "3" },
        { title: "Thursday", value: "4" },
        { title: "Friday", value: "5" },
        { title: "Saturday", value: "6" },
        { title: "Sunday", value: "0" }
    ]);
});

// -------------------------------------------------------------------
// MAIN CALCULATION & TASK CREATION ENDPOINT
// -------------------------------------------------------------------
app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // Destructure keys exactly as they appear in your Developer Center
        // 'name' matches your recent update to the Task Name field key
        const { boardId, groupId, tagsColumn, tag_names, name } = inputFields;

        // 1. DATE CALCULATION (Due on the Nth X-day of the current month)
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Find the first occurrence of the selected day
        while (d.getDay() !== parseInt(day)) {
            d.setDate(d.getDate() + 1);
        }
        
        // Add weeks to get to the Nth occurrence
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const dueDate = d.toISOString().split('T')[0];

        // 2. COLUMN VALUES STRUCTURE
        // For 'tag' columns, Monday requires an object: { "tag_labels": ["Name"] }
        // Sending just a string causes the "ColumnValueException"
