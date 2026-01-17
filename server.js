const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🌐 HEALTH CHECKS ---
// This handles the [GET] / seen in your logs to keep the connection alive
app.get('/', (req, res) => {
    console.log("🟦 Root health check received");
    res.status(200).send("OK");
});

// --- 📅 DROPDOWN ENDPOINTS ---
// If these URLs aren't perfect, the recipe builder will show the "Oops" error
app.all('/get-nth-options', (req, res) => {
    console.log("📡 Fetching Nth options...");
    return res.json([
        {title: "1st", value: "1"}, {title: "2nd", value: "2"}, 
        {title: "3rd", value: "3"}, {title: "4th", value: "4"}
    ]);
});

app.all('/get-day-options', (req, res) => {
    console.log("📡 Fetching Day options...");
    return res.json([
        {title: "Monday", value: "1"}, {title: "Tuesday", value: "2"}, 
        {title: "Wednesday", value: "3"}, {title: "Thursday", value: "4"}, 
        {title: "Friday", value: "5"}, {title: "Saturday", value: "6"}, 
        {title: "Sunday", value: "0"}
    ]);
});

// --- 🚀 THE MAIN ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        const { boardId, columnId, status_label_text, task_name, assignee_id } = inputFields;
        const cleanStatusLabel = status_label_text ? status_label_text.trim() : "";

        // Recurring Date Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "label": cleanStatusLabel } 
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'Content-Type': 'application/json', 
                'API-Version': '2024-01' 
            } 
        });

        console.log(`✅ Success: ${task_name} created.`);
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action failed:", err.message);
        res.status(200).send({});
    }
});

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
